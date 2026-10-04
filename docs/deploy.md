# Деплой

Один VPS с Docker Compose: **Caddy** (HTTPS, статика клиента), **сервер партий** (Node.js)
и **PostgreSQL** (аккаунты и история партий).
Деплой — одна команда `docker compose up -d --build`; после настройки GitHub Actions
выкатывает каждый зелёный коммит в `main` сам.

```
 Браузер ──HTTPS──▶ Caddy (web) ──/socket.io, /api, /health──▶ server:3000 ──▶ db:5432 (PostgreSQL)
                      │
                      └── /, /assets/*, /g/… → статика клиента (SPA)
```

Гостевые аккаунты и законченные партии хранятся в PostgreSQL (том `pg_data`) и переживают деплой. Идущие партии
пока живут в памяти сервера: **перезапуск или деплой завершает их**. Это уйдёт, когда партии
переедут в Redis (срез «Хранение»). Миграции базы сервер применяет сам при запуске.

## 1. Что нужно и сколько стоит

| Что | Где | Цена (октябрь 2026) |
|---|---|---|
| VPS **Hetzner CX23** (2 vCPU, 4 ГБ, 40 ГБ) | [hetzner.com/cloud](https://www.hetzner.com/cloud) | €5,49/мес + IPv4 (≈ €0,50/мес) |
| Домен `9-korgool.kg` | [cctld.kg](https://www.cctld.kg) | по прайсу cctld.kg |
| DNS | Hetzner Console → DNS | бесплатно |
| HTTPS-сертификат | Let's Encrypt (Caddy получает сам) | бесплатно |
| Sentry *(необязательно)* | [sentry.io](https://sentry.io), план Developer | бесплатно, 5000 ошибок/мес |

Подойдёт любой VPS с Ubuntu и 2+ ГБ памяти (Contabo, местный хостинг КР) — шаги 3–6 те же.

## 2. Домен и DNS

1. Заведите аккаунт Hetzner. В [Hetzner Console](https://console.hetzner.com) откройте проект →
   **DNS** → добавьте зону `9-korgool.kg`. Зону лучше создать **до** того, как отдать серверы имён
   регистратору: некоторые реестры проверяют, что зона уже есть.
2. При покупке домена на cctld.kg укажите серверы имён Hetzner:
   ```
   hydrogen.ns.hetzner.com
   oxygen.ns.hetzner.com
   helium.ns.hetzner.de
   ```
   Изменения в зоне .kg применяются не сразу — до 48 часов.
3. Когда появится сервер (шаг 3), добавьте в зоне записи:
   | Тип | Имя | Значение |
   |---|---|---|
   | A | `@` | IPv4 сервера |
   | AAAA | `@` | IPv6 сервера *(необязательно)* |

Проверка: `dig +short 9-korgool.kg` возвращает IP сервера.

## 3. Сервер

В Hetzner Console → **Servers → Add server**:

- Локация: Falkenstein / Nuremberg / Helsinki (до Бишкека ~80–100 мс — для пошаговой игры достаточно).
- Образ: **Ubuntu 24.04**. Тип: **Shared vCPU → CX23**. Публичный IPv4 — включить.
- **SSH key**: добавьте свой публичный ключ (`~/.ssh/id_ed25519.pub`); вход по паролю не нужен.
- **Firewall**: создайте правило «входящие» — TCP 22, TCP 80, TCP 443, UDP 443 (HTTP/3).

Подготовка (один раз, под `root`):

```sh
ssh root@<IP>
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh          # Docker и плагин compose
adduser --disabled-password --gecos "" deploy   # пользователь для деплоя
usermod -aG docker deploy
install -d -o deploy -g deploy /opt/korgool
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
```

## 4. Настройки на сервере

```sh
ssh deploy@<IP>
cd /opt/korgool
nano .env      # пример — .env.example в репозитории
```

```sh
DOMAIN=9-korgool.kg
POSTGRES_PASSWORD=...   # openssl rand -hex 32
BETTER_AUTH_SECRET=...  # openssl rand -hex 32, другое значение
SENTRY_DSN=
VITE_SENTRY_DSN=
```

`BETTER_AUTH_SECRET` подписывает cookie сессий: если его сменить, все гости получат новые
аккаунты. `POSTGRES_PASSWORD` задаётся один раз: база запоминает его при первом запуске.

## 5. Первый деплой

С вашего компьютера, из корня репозитория:

```sh
rsync -az --delete --exclude .git --exclude .env --exclude node_modules ./ deploy@<IP>:/opt/korgool/
ssh deploy@<IP> "cd /opt/korgool && docker compose up -d --build"
```

Сборка на CX23 занимает несколько минут. Затем откройте `https://9-korgool.kg` —
Caddy получит сертификат при первом запросе (DNS уже должен указывать на сервер).
Проверка: `curl https://9-korgool.kg/health` → `{"ok":true,"games":0}`.

## 6. Автодеплой из GitHub

Workflow [`deploy.yml`](../.github/workflows/deploy.yml) после зелёного CI в `main` копирует
код на сервер и пересобирает контейнеры, затем проверяет `/health`. Пока не задана переменная
`DEPLOY_HOST`, он ничего не делает.

1. Сгенерируйте отдельный ключ для GitHub (без пароля):
   ```sh
   ssh-keygen -t ed25519 -N "" -f korgool-deploy -C github-deploy
   ssh-copy-id -i korgool-deploy.pub deploy@<IP>
   ssh-keyscan <IP>          # вывод — для DEPLOY_KNOWN_HOSTS
   ```
2. GitHub → репозиторий → **Settings → Secrets and variables → Actions**:
   | Вид | Имя | Значение |
   |---|---|---|
   | Variable | `DEPLOY_HOST` | IP или домен сервера |
   | Variable | `DEPLOY_USER` | `deploy` *(по умолчанию)* |
   | Variable | `DEPLOY_DIR` | `/opt/korgool` *(по умолчанию)* |
   | Secret | `DEPLOY_SSH_KEY` | содержимое файла `korgool-deploy` (приватный ключ) |
   | Secret | `DEPLOY_KNOWN_HOSTS` | вывод `ssh-keyscan` |
3. Запустить вручную: **Actions → Deploy → Run workflow**.

## 7. Sentry (необязательно)

Создайте в Sentry проект Node.js (и, по желанию, Browser JavaScript), впишите DSN в `.env`:
`SENTRY_DSN` — ошибки сервера, `VITE_SENTRY_DSN` — ошибки в браузере (вшивается при сборке
образа `web`). Пустые значения — Sentry выключен.

## 8. Обслуживание

```sh
cd /opt/korgool
docker compose ps                  # состояние (у server есть healthcheck)
docker compose logs -f server      # логи сервера партий
docker compose restart server      # перезапуск (идущие партии завершатся)
docker compose exec db psql -U korgool   # консоль базы
docker compose exec db pg_dump -U korgool korgool | gzip > korgool-$(date +%F).sql.gz  # резервная копия
docker system df                   # место под образы; чистит деплой: docker image prune
```

Обновления ОС: `apt upgrade` раз в месяц. В базе гостевые аккаунты и история партий; когда
появится вход через Google и профиль с историей, стоит включить Hetzner Backups (+20 % к цене)
или ежедневный `pg_dump` по cron.
