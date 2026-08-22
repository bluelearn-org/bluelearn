import { forwardRef, useEffect, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import type {
  ActivityFilters,
  ActivitySort,
  ActivityStatusFilter,
  ActivityTypeFilter,
} from "@bluelearn/schemas";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type SetFilters = (next: Partial<ActivityFilters>) => void;

function formatMDY(date: Date | undefined) {
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

// yyyy-mm-dd in local time, which is what the URL stores
function toISODate(date: Date | undefined) {
  if (!date) return undefined;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseISODate(value: string | undefined) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function ColumnFilter({
  label,
  active,
  onClear,
  className,
  children,
}: {
  label: string;
  active: boolean;
  onClear: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1.5 uppercase transition-colors",
              active ? "text-brand-bright-blue" : "hover:text-foreground/70"
            )}
          >
            <span>{label}</span>
            <SlidersHorizontalIcon className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn("w-56 gap-3 tracking-normal normal-case", className)}
        >
          <div className="text-xs font-medium">
            Filter by {label.toLowerCase()}
          </div>
          {children}
        </PopoverContent>
      </Popover>
      {active && (
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          onClick={onClear}
          className="flex size-4 cursor-pointer items-center justify-center rounded text-brand-bright-blue hover:bg-brand-bright-blue/10"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function SortRow({
  active,
  ascending,
  label,
  onClick,
}: {
  active: boolean;
  ascending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        active ? "bg-accent text-foreground" : "hover:bg-muted"
      )}
    >
      {ascending ? (
        <ArrowUpIcon className="size-3.5" />
      ) : (
        <ArrowDownIcon className="size-3.5" />
      )}
      <span>{label}</span>
    </button>
  );
}

export function TextColumnFilter({
  label,
  field,
  search,
  setFilters,
}: {
  label: string;
  field: "title" | "summary";
  search: ActivityFilters;
  setFilters: SetFilters;
}) {
  const asc = `${field}_asc` as ActivitySort;
  const desc = `${field}_desc` as ActivitySort;
  const colSort =
    search.sort === asc ? "asc" : search.sort === desc ? "desc" : null;
  const active = Boolean(search[field]) || colSort !== null;

  return (
    <ColumnFilter
      label={label}
      active={active}
      onClear={() =>
        setFilters({
          [field]: undefined,
          sort: colSort ? undefined : search.sort,
        })
      }
    >
      <Input
        value={search[field] ?? ""}
        onChange={(e) => setFilters({ [field]: e.target.value || undefined })}
        placeholder={`Search ${label.toLowerCase()}...`}
        className="h-7"
      />
      <div className="flex flex-col">
        <SortRow
          ascending
          label="Sort A - Z"
          active={colSort === "asc"}
          onClick={() =>
            setFilters({ sort: colSort === "asc" ? undefined : asc })
          }
        />
        <SortRow
          ascending={false}
          label="Sort Z - A"
          active={colSort === "desc"}
          onClick={() =>
            setFilters({ sort: colSort === "desc" ? undefined : desc })
          }
        />
      </div>
    </ColumnFilter>
  );
}

export function ChoiceColumnFilter({
  label,
  field,
  options,
  search,
  setFilters,
}: {
  label: string;
  field: "type" | "status";
  options: ReadonlyArray<{
    value: ActivityTypeFilter | ActivityStatusFilter;
    label: string;
  }>;
  search: ActivityFilters;
  setFilters: SetFilters;
}) {
  const selected = new Set<string>(search[field] ?? []);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setFilters({ [field]: next.size ? [...next] : undefined });
  }

  return (
    <ColumnFilter
      label={label}
      active={selected.size > 0}
      onClear={() => setFilters({ [field]: undefined })}
    >
      <div className="flex flex-col gap-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-muted"
          >
            <Checkbox
              checked={selected.has(option.value)}
              onCheckedChange={() => toggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </ColumnFilter>
  );
}

export function DateColumnFilter({
  search,
  setFilters,
}: {
  search: ActivityFilters;
  setFilters: SetFilters;
}) {
  const from = parseISODate(search.from);
  const to = parseISODate(search.to);
  const colSort =
    search.sort === "date_asc"
      ? "asc"
      : search.sort === undefined
        ? "desc"
        : null;
  const active =
    Boolean(search.from || search.to) || search.sort === "date_asc";

  // Which field the calendar popover is editing (null closes it).
  const [activeField, setActiveField] = useState<"from" | "to" | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date | undefined>(undefined);

  function openField(field: "from" | "to") {
    const date = field === "to" ? to : from;
    setVisibleMonth(date ?? from ?? to ?? new Date());
    setActiveField(field);
  }

  // Swap dates if end date is earlier than start date.
  function commit(nextFrom: Date | undefined, nextTo: Date | undefined) {
    let start = nextFrom;
    let end = nextTo;
    if (start && end && start > end) [start, end] = [end, start];
    setFilters({ from: toISODate(start), to: toISODate(end) });
  }

  function onSetDate(date: Date | undefined) {
    if (activeField === "to") commit(from, date);
    else commit(date, to);
  }

  // Start date calendar click advances to the end date field, then
  // closes on the end date click.
  function onPickDay(date: Date | undefined) {
    onSetDate(date);
    if (activeField === "to") {
      setActiveField(null);
    } else {
      setVisibleMonth(to ?? new Date());
      setActiveField("to");
    }
  }

  const activeDate = activeField === "to" ? to : from;

  return (
    <ColumnFilter
      label="Date"
      active={active}
      onClear={() =>
        setFilters({
          from: undefined,
          to: undefined,
          sort: search.sort === "date_asc" ? undefined : search.sort,
        })
      }
      className="w-auto"
    >
      <Popover
        open={activeField !== null}
        onOpenChange={(open) => {
          if (!open) setActiveField(null);
        }}
      >
        <div className="flex items-center gap-2">
          <FieldAnchor active={activeField === "from"}>
            <DateField
              active={activeField === "from"}
              date={from}
              onClick={() => openField("from")}
            />
          </FieldAnchor>
          <span className="text-muted-foreground">and</span>
          <FieldAnchor active={activeField === "to"}>
            <DateField
              active={activeField === "to"}
              date={to}
              onClick={() => openField("to")}
            />
          </FieldAnchor>
        </div>
        <PopoverContent
          align="start"
          className="w-auto gap-3 tracking-normal normal-case"
        >
          <SegmentedDateInput
            value={activeDate}
            onChange={onSetDate}
            onNavigate={setVisibleMonth}
          />
          <Calendar
            mode="single"
            selected={activeDate}
            onSelect={onPickDay}
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
          />
        </PopoverContent>
      </Popover>

      <div className="flex flex-col">
        <SortRow
          ascending={false}
          label="Sort Newest"
          active={colSort === "desc"}
          onClick={() => setFilters({ sort: undefined })}
        />
        <SortRow
          ascending
          label="Sort Oldest"
          active={colSort === "asc"}
          onClick={() =>
            setFilters({ sort: colSort === "asc" ? undefined : "date_asc" })
          }
        />
      </div>
    </ColumnFilter>
  );
}

function SegmentedDateInput({
  value,
  onChange,
  onNavigate,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  onNavigate: (date: Date) => void;
}) {
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  // Time value we last emitted, so our own echo doesn't stomp typing.
  const lastEmitted = useRef<number | null>(null);

  // Sync segments only on external changes (calendar, field switch, clear),
  // not when value just echoes back what we typed.
  const valueTime = value ? value.getTime() : null;
  useEffect(() => {
    if (valueTime !== null && valueTime === lastEmitted.current) return;
    if (valueTime === null) {
      setMonth("");
      setDay("");
      setYear("");
      return;
    }
    const date = new Date(valueTime);
    setMonth(String(date.getMonth() + 1).padStart(2, "0"));
    setDay(String(date.getDate()).padStart(2, "0"));
    setYear(String(date.getFullYear()));
  }, [valueTime]);

  function emit(m: string, d: string, y: string) {
    if (!m || !d || y.length !== 4) return;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (date.getMonth() === Number(m) - 1 && date.getDate() === Number(d)) {
      lastEmitted.current = date.getTime();
      onChange(date);
    }
  }

  // Steer the calendar view from whatever month/year is typed so far,
  // falling back to the current value for the segment left blank.
  function navigate(m: string, y: string) {
    const base = value ?? new Date();
    const monthNum = Number(m);
    const monthIdx =
      m && monthNum >= 1 && monthNum <= 12 ? monthNum - 1 : base.getMonth();
    const yearNum = Number(y);
    const yearVal = y.length === 4 ? yearNum : base.getFullYear();
    onNavigate(new Date(yearVal, monthIdx, 1));
  }

  function onMonth(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const done = digits.length === 2 || Number(digits) > 1;
    const next = done ? digits.padStart(2, "0") : digits;
    setMonth(next);
    emit(next, day, year);
    navigate(next, year);
    if (done && digits) {
      dayRef.current?.focus();
      dayRef.current?.select();
    }
  }

  function onDay(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const done = digits.length === 2 || Number(digits) > 3;
    const next = done ? digits.padStart(2, "0") : digits;
    setDay(next);
    emit(month, next, year);
    if (done && digits) {
      yearRef.current?.focus();
      yearRef.current?.select();
    }
  }

  function onYear(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setYear(digits);
    emit(month, day, digits);
    navigate(month, digits);
  }

  return (
    <div className="flex items-center rounded-md border border-input px-2 py-1.5 text-sm focus-within:border-brand-bright-blue">
      <input
        ref={monthRef}
        value={month}
        onChange={(e) => onMonth(e.target.value)}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        placeholder="MM"
        className="w-7 bg-transparent text-center tabular-nums caret-transparent outline-none placeholder:font-light placeholder:text-muted-foreground focus:rounded-md focus:bg-brand-bright-blue/15"
      />
      <span className="px-1 text-muted-foreground">/</span>
      <input
        ref={dayRef}
        value={day}
        onChange={(e) => onDay(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && !day) monthRef.current?.focus();
        }}
        inputMode="numeric"
        placeholder="DD"
        className="w-7 bg-transparent text-center tabular-nums caret-transparent outline-none placeholder:font-light placeholder:text-muted-foreground focus:rounded-md focus:bg-brand-bright-blue/15"
      />
      <span className="px-1 text-muted-foreground">/</span>
      <input
        ref={yearRef}
        value={year}
        onChange={(e) => onYear(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && !year) dayRef.current?.focus();
        }}
        inputMode="numeric"
        placeholder="YYYY"
        className="w-11 bg-transparent text-center tabular-nums caret-transparent outline-none placeholder:font-light placeholder:text-muted-foreground focus:rounded-md focus:bg-brand-bright-blue/15"
      />
    </div>
  );
}

// Anchor the calendar popover to the box being edited so it left-aligns with it
function FieldAnchor({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  if (!active) return children;
  return <PopoverAnchor asChild>{children}</PopoverAnchor>;
}

const DateField = forwardRef<
  HTMLButtonElement,
  { active: boolean; date: Date | undefined; onClick: () => void }
>(function DateFieldButton({ active, date, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors",
        active ? "border-brand-bright-blue" : "border-input hover:bg-muted",
        !date && "text-muted-foreground"
      )}
    >
      {date ? formatMDY(date) : "Select date"}
    </button>
  );
});
