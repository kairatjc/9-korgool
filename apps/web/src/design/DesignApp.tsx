import ComparePage from './ComparePage';
import DesignRoute from './DesignRoute';

export function DesignApp() {
  return location.pathname.startsWith('/__design/compare') ? <ComparePage /> : <DesignRoute />;
}
