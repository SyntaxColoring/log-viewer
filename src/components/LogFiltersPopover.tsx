import { ListFilter, ListFilterPlus } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/shadcn/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/shadcn/components/ui/combobox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/shadcn/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shadcn/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/ui/select";
import { cn } from "@/shadcn/lib/utils";

import type { SyslogPriority } from "@/backend";

const PRIORITY_LABELS = [
  "emerg",
  "alert",
  "crit",
  "err",
  "warning",
  "notice",
  "info",
  "debug (show everything)",
] as const;

const PRIORITY_ICON_BG: readonly string[] = [
  "bg-red-800", // priority 0 (emerg)
  "bg-red-700", // priority 1 (alert)
  "bg-red-600", // priority 2 (crit)
  "bg-red-500", // priority 3 (err)
  "bg-amber-500", // priority 4 (warning)
  "bg-sky-500", // priority 5 (notice)
  "bg-sky-400", // priority 6 (info)
  "bg-slate-500", // priority 7 (debug)
];

export interface LogFiltersPopoverProps {
  filters: FilterFieldValues;
  onFiltersChange: (newFilters: FilterFieldValues) => void;

  unitOptions: string[];
  syslogIdentifierOptions: string[];
}

export interface FilterFieldValues {
  leastSeverePriority: SyslogPriority;
  units: string[];
  syslogIdentifiers: string[];
}

export const DEFAULT_PRIORITY = 7;

const DEFAULT_FILTERS: FilterFieldValues = {
  leastSeverePriority: DEFAULT_PRIORITY,
  units: [],
  syslogIdentifiers: [],
};

export function LogFiltersPopover(props: LogFiltersPopoverProps): JSX.Element {
  const { filters, onFiltersChange, unitOptions, syslogIdentifierOptions } =
    props;

  const active = hasActiveFilters(filters);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant={active ? "default" : "outline"} />}
      >
        {active ? (
          <ListFilterPlus data-icon="inline-start" />
        ) : (
          <ListFilter data-icon="inline-start" />
        )}
        Filter
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <PopoverHeader>
          <PopoverTitle>Filters</PopoverTitle>
        </PopoverHeader>

        <FieldGroup>
          <LeastSeverePriorityFilterField
            value={filters.leastSeverePriority}
            onValueChange={(next) => {
              onFiltersChange({ ...filters, leastSeverePriority: next });
            }}
          />

          <MultiSelectFilterField
            label="Systemd units"
            placeholder="Select systemd units..."
            options={unitOptions}
            value={filters.units}
            onValueChange={(next) => {
              onFiltersChange({ ...filters, units: next });
            }}
          />

          <MultiSelectFilterField
            label="Syslog identifiers"
            placeholder="Select syslog identifiers..."
            options={syslogIdentifierOptions}
            value={filters.syslogIdentifiers}
            onValueChange={(next) => {
              onFiltersChange({ ...filters, syslogIdentifiers: next });
            }}
          />
        </FieldGroup>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={!active}
            onClick={() => {
              onFiltersChange(DEFAULT_FILTERS);
            }}
          >
            Reset all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function hasActiveFilters(filters: FilterFieldValues): boolean {
  return (
    filters.leastSeverePriority !== DEFAULT_FILTERS.leastSeverePriority ||
    filters.units.length > 0 ||
    filters.syslogIdentifiers.length > 0
  );
}

function PrioritySeverityIcon({
  syslogPriority,
}: {
  syslogPriority: number;
}): JSX.Element {
  const bg =
    syslogPriority >= 0 && syslogPriority < PRIORITY_ICON_BG.length
      ? PRIORITY_ICON_BG[syslogPriority]
      : "bg-muted-foreground";
  return <span className={cn("block size-2.5 flex-none rounded-full", bg)} />;
}

interface LeastSeverePriorityFilterFieldProps {
  value: SyslogPriority;
  onValueChange: (value: SyslogPriority) => void;
}

function LeastSeverePriorityFilterField(
  props: LeastSeverePriorityFilterFieldProps,
): JSX.Element {
  const { value, onValueChange } = props;
  return (
    <Field>
      <FieldLabel>Minimum priority</FieldLabel>
      <FieldContent>
        <Select
          value={value}
          onValueChange={(next) => {
            if (next === null) return;
            onValueChange(next);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(selected: number) => (
                <div className="flex items-center gap-1.5">
                  <PrioritySeverityIcon syslogPriority={selected} />
                  {PRIORITY_LABELS[selected]}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {Array.from({ length: PRIORITY_LABELS.length }, (_, i) => {
                const syslogPriority = PRIORITY_LABELS.length - 1 - i;
                return (
                  <SelectItem key={syslogPriority} value={syslogPriority}>
                    <div className="flex items-center gap-1.5">
                      <PrioritySeverityIcon syslogPriority={syslogPriority} />
                      {PRIORITY_LABELS[syslogPriority]}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
  );
}

interface MultiSelectFilterFieldProps {
  label: string;
  placeholder: string;
  options: string[];
  value: string[];
  onValueChange: (value: string[]) => void;
}

function MultiSelectFilterField(
  props: MultiSelectFilterFieldProps,
): JSX.Element {
  const { label, placeholder, options, value, onValueChange } = props;
  const anchorRef = useComboboxAnchor();

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldContent>
        <Combobox
          multiple
          items={options}
          value={value}
          onValueChange={onValueChange}
          autoHighlight
        >
          <ComboboxChips ref={anchorRef}>
            {value.map((selectedValue) => (
              <ComboboxChip key={selectedValue}>{selectedValue}</ComboboxChip>
            ))}
            <ComboboxChipsInput
              placeholder={value.length === 0 ? placeholder : undefined}
            />
          </ComboboxChips>
          <ComboboxContent anchor={anchorRef}>
            <ComboboxEmpty>No results found.</ComboboxEmpty>
            <ComboboxList>
              <ComboboxCollection>
                {(option: string) => (
                  <ComboboxItem key={option} value={option}>
                    {option}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FieldContent>
    </Field>
  );
}
