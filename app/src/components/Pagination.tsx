import type { JSX } from "react";
import {
  PaginationBase,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination-base";

export type PaginationWrapperPropTypes = {
  activePageNo: number;
  onPageSelect: (pageNo: number) => void;
  toFirst: VoidFunction;
  onPrevious: VoidFunction;
  onNext: VoidFunction;
  toLast: VoidFunction;
  totalPages: number;
};
export const Pagination = ({
  activePageNo,
  onPageSelect,
  toFirst,
  onPrevious,
  onNext,
  toLast,
  totalPages,
}: PaginationWrapperPropTypes): JSX.Element => {
  return (
    <PaginationBase>
      <PaginationContent>
        <PaginationItem>
          <PaginationFirst onClick={toFirst} />
        </PaginationItem>
        <PaginationItem>
          <PaginationPrevious onClick={onPrevious} />
        </PaginationItem>

        <Pages
          activePageNo={activePageNo}
          onPageSelect={onPageSelect}
          totalPages={totalPages}
        />

        <PaginationItem>
          <PaginationNext onClick={onNext} />
        </PaginationItem>
        <PaginationItem>
          <PaginationLast onClick={toLast} />
        </PaginationItem>
      </PaginationContent>
    </PaginationBase>
  );
};

const Pages = ({
  activePageNo,
  totalPages,
  onPageSelect,
}: Pick<
  PaginationWrapperPropTypes,
  "activePageNo" | "totalPages" | "onPageSelect"
>): JSX.Element => {
  const EXTRA_PAGES_TO_SHOW = 1;
  const renderedPages: Array<JSX.Element> = [];
  const activePage = activePageNo > totalPages ? totalPages : activePageNo;

  const startPage =
    activePage > EXTRA_PAGES_TO_SHOW ? activePage - EXTRA_PAGES_TO_SHOW : 1;

  const doesExtraLastPagesOverflow =
    activePage + EXTRA_PAGES_TO_SHOW > totalPages;
  const lastPage = doesExtraLastPagesOverflow
    ? totalPages
    : activePage + EXTRA_PAGES_TO_SHOW;

  if (startPage !== 1) {
    renderedPages.push(
      <PaginationItem>
        <PaginationEllipsis />
      </PaginationItem>
    );
  }

  for (let pageNo = startPage; pageNo <= lastPage; pageNo++) {
    renderedPages.push(
      <Page
        pageNo={pageNo}
        activePageNo={activePage}
        onPageSelect={onPageSelect}
      />
    );
  }

  if (lastPage + EXTRA_PAGES_TO_SHOW < totalPages) {
    renderedPages.push(
      <PaginationItem>
        <PaginationEllipsis />
      </PaginationItem>
    );
  }

  return <>{renderedPages}</>;
};

const Page = ({
  pageNo,
  activePageNo,
  onPageSelect,
}: { pageNo: number } & Pick<
  PaginationWrapperPropTypes,
  "activePageNo" | "onPageSelect"
>) => {
  return (
    <PaginationItem key={pageNo}>
      <PaginationLink
        onClick={() => onPageSelect(pageNo)}
        isActive={pageNo === activePageNo}
      >
        {pageNo}
      </PaginationLink>
    </PaginationItem>
  );
};
