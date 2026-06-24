import { Card, Switch } from './ui';
import { Filter } from './Icons';
import './FilterPanel.css';

export interface FilterPanelProps {
  showOnlyMyAnnotations: boolean;
  onChangeShowOnlyMyAnnotations: (show: boolean) => void;
  isAuthenticated: boolean;
}

export const FilterPanel = ({
  showOnlyMyAnnotations,
  onChangeShowOnlyMyAnnotations,
  isAuthenticated,
}: FilterPanelProps) => {
  return (
    <div className="filter-panel-container animate-fade-in">
      <Card variant="default" className="filter-panel-card">
        <div className="filter-panel-title">
          <Filter size={14} className="filter-icon" />
          <span>Filters</span>
        </div>
        <div className="filter-panel-body">
          <Switch
            id="my-discoveries-toggle"
            checked={showOnlyMyAnnotations}
            onChange={(checked) => {
              if (isAuthenticated) {
                onChangeShowOnlyMyAnnotations(checked);
              }
            }}
            label="My Discoveries"
          />
          {!isAuthenticated && (
            <span className="filter-disclaimer">Sign in to filter discoveries</span>
          )}
        </div>
      </Card>
    </div>
  );
};
