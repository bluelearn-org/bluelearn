import { useId } from "react";
import {
  ChoiceColumnFilter,
  DateColumnFilter,
  ColumnFilter as FilterPopover,
  SortRow,
} from "./ActivityColumnFilters";
import type { DashboardColumn, DashboardFilters } from "@/lib/dashboardFilters";
import {
  filterText,
  timeLeftOptions,
  validHours,
} from "@/lib/dashboardFilters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function ColumnFilter<T>({
  column,
  filters,
  onChange,
}: {
  column: DashboardColumn<T>;
  filters: DashboardFilters;
  onChange: (changes: DashboardFilters) => void;
}) {
  const { key, label, kind } = column;
  const radioId = useId();
  const direction =
    filters.sortBy === key ? filterText(filters.sortDirection) : "";
  const sort = direction === "asc" || direction === "desc" ? direction : null;
  const clearSort =
    filters.sortBy === key
      ? { sortBy: undefined, sortDirection: undefined }
      : {};
  const setSort = (next: "asc" | "desc" | null) =>
    onChange(next ? { sortBy: key, sortDirection: next } : clearSort);

  if (kind === "duration") {
    const mode = filterText(filters[key]);
    const min = filterText(filters[`${key}.min`]);
    const max = filterText(filters[`${key}.max`]);
    const invalid =
      !validHours(min) ||
      !validHours(max) ||
      (min.trim() !== "" && max.trim() !== "" && Number(min) > Number(max));
    return (
      <FilterPopover
        label={label}
        active={Boolean(mode) || sort !== null}
        onClear={() =>
          onChange({
            [key]: undefined,
            [`${key}.min`]: undefined,
            [`${key}.max`]: undefined,
            ...clearSort,
          })
        }
      >
        <RadioGroup
          aria-label="Time Left range"
          className="flex flex-col gap-0.5"
          value={mode}
          onValueChange={(value) => onChange({ [key]: value || undefined })}
        >
          {timeLeftOptions.map((option) => (
            <div
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-muted"
            >
              <RadioGroupItem
                id={`${radioId}-${option.value || "any"}`}
                value={option.value}
              />
              <Label
                htmlFor={`${radioId}-${option.value || "any"}`}
                className="flex-1 cursor-pointer"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {mode === "custom" && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              Minimum:
              <Input
                type="number"
                min="0"
                step="any"
                aria-label="Minimum hours"
                aria-invalid={invalid}
                value={min}
                className="h-7"
                onChange={(event) =>
                  onChange({ [`${key}.min`]: event.target.value })
                }
              />{" "}
              hrs
            </label>
            <label className="flex items-center gap-2">
              Maximum:
              <Input
                type="number"
                min="0"
                step="any"
                aria-label="Maximum hours"
                aria-invalid={invalid}
                value={max}
                className="h-7"
                onChange={(event) =>
                  onChange({ [`${key}.max`]: event.target.value })
                }
              />{" "}
              hrs
            </label>
            {invalid && (
              <p role="alert" className="text-xs text-destructive">
                Enter non-negative hours with minimum no greater than maximum.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col">
          <SortRow
            ascending={false}
            label="Sort Newest"
            active={sort === "desc"}
            onClick={() => setSort(sort === "desc" ? null : "desc")}
          />
          <SortRow
            ascending
            label="Sort Oldest"
            active={sort === "asc"}
            onClick={() => setSort(sort === "asc" ? null : "asc")}
          />
        </div>
      </FilterPopover>
    );
  }

  if (kind === "date") {
    return (
      <DateColumnFilter
        label={label}
        search={{
          from: filterText(filters[`${key}.from`]) || undefined,
          to: filterText(filters[`${key}.to`]) || undefined,
        }}
        setFilters={(next) =>
          onChange({ [`${key}.from`]: next.from, [`${key}.to`]: next.to })
        }
        sortControl={{
          direction: sort,
          onChange: setSort,
          onClear: () =>
            onChange({
              [`${key}.from`]: undefined,
              [`${key}.to`]: undefined,
              ...clearSort,
            }),
        }}
      />
    );
  }
  if (kind === "choice") {
    const selected = filters[key];
    return (
      <ChoiceColumnFilter
        label={label}
        field="subject"
        options={(column.options ?? []).map((value) => ({
          value,
          label: value,
        }))}
        search={{ subject: Array.isArray(selected) ? selected : [] }}
        setFilters={(next) => onChange({ [key]: next.subject })}
      />
    );
  }
  const value = filterText(filters[key]);
  return (
    <FilterPopover
      label={label}
      active={Boolean(value.trim()) || sort !== null}
      onClear={() => onChange({ [key]: undefined, ...clearSort })}
    >
      <Input
        type="search"
        aria-label={`Search ${label}`}
        value={value}
        onChange={(event) => onChange({ [key]: event.target.value })}
        placeholder={`Search ${label.toLowerCase()}...`}
        className="h-7"
      />
      <div className="flex flex-col">
        <SortRow
          ascending
          label="Sort A - Z"
          active={sort === "asc"}
          onClick={() => setSort(sort === "asc" ? null : "asc")}
        />
        <SortRow
          ascending={false}
          label="Sort Z - A"
          active={sort === "desc"}
          onClick={() => setSort(sort === "desc" ? null : "desc")}
        />
      </div>
    </FilterPopover>
  );
}
