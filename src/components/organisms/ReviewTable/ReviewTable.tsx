"use client"

import * as React from "react"
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Search,
    X,
    Star,
    UserPen
} from "lucide-react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    Column,
    Row,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui"
import {
    Dialog,
    DialogTrigger,
} from "@/components/ui"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Review } from "@/hooks/useData"
import { exercises } from "@/lib/data/exercises"

const ReviewTable = ({
    data,
    onRowClick,
    onDataRefresh,
    type = 'pending', // 'pending' or 'completed'
}: {
    data: Review[];
    onRowClick?: (review: Review) => void;
    onDataRefresh?: () => void;
    type?: 'pending' | 'completed';
}) => {
    const router = useRouter()
    // FUTURE: Reviewer membership not enforced. Doctor limited by patient quota only. Uncomment to hide review button when expired:
    // const { data: reviewerData } = useReviewerMe(true)
    // const isMembershipActive = reviewerData?.isMembershipActive ?? false
    const [rowSelection, setRowSelection] = React.useState({})
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({})
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
    )
    const [sorting, setSorting] = React.useState<SortingState>([
        {
            id: type === 'pending' ? "submittedDate" : "reviewDate",
            desc: true
        }
    ])
    const [globalFilter, setGlobalFilter] = React.useState("")
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: 10,
    })
    const [openDialogNewReview, setOpenDialogNewReview] = React.useState(false)

    const renderStars = (rating: number | null) => {
        if (rating === null) {
            return <span className="text-sm text-gray-500">Not rated</span>
        }

        return (
            <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                    <Star
                        key={i}
                        className={`w-4 h-4 ${i < rating ? 'fill-orange-400 text-orange-400' : 'text-gray-300'}`}
                    />
                ))}
                <span className="text-sm text-gray-600 ml-1">{rating}/5</span>
            </div>
        )
    }

    const columns: ColumnDef<Review>[] = [
        {
            accessorKey: "patientName",
            header: ({ column }) => {
                return (
                    <div className="flex items-center gap-2">
                        <span>Patient</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    A-Z
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    Z-A
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
            cell: ({ row }) => {
                const review = row.original
                return (
                    <div className="flex flex-col">
                        <span className="font-medium">{review.patientName}</span>
                        <span className="text-sm text-gray-500">{review.patientEmail}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "exerciseType",
            header: "Exercise Type",
            cell: ({ row }) => {
                const exerciseId = row.original.exerciseType;
                const exercise = exerciseId ? exercises.find(e => e.id === exerciseId) : null;
                return (
                    <div className="text-sm text-gray-600">
                        {exercise ? exercise.name : 'N/A'}
                    </div>
                )
            },
        },
        {
            accessorKey: type === 'pending' ? "submittedDate" : "reviewDate",
            header: ({ column }) => {
                return (
                    <div className="flex items-center gap-2">
                        <span>{type === 'pending' ? 'Submitted' : 'Reviewed'}</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    Newest First
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    Oldest First
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
            cell: ({ row }) => {
                const date = type === 'pending' ? row.original.submittedDate : row.original.reviewDate
                if (!date) return 'N/A'
                return new Date(date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })
            },
        },
        // Only show rating column for completed reviews
        ...(type === 'completed' ? [{
            accessorKey: "rating",
            header: ({ column }: { column: Column<Review> }) => {
                return (
                    <div className="flex items-center gap-2">
                        <span>Rating</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    Highest First
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    Lowest First
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
            cell: ({ row }: { row: Row<Review> }) => {
                return renderStars(row.original.rating)
            },
        }] : []),
        // Only show comments column for completed reviews
        ...(type === 'completed' ? [{
            accessorKey: "comments",
            header: "Comments",
            meta: { className: "min-w-[320px] whitespace-normal" },
            cell: ({ row }: { row: Row<Review> }) => {
                const comments = row.original.comments
                const isPending = row.original.status === 'pending'
                return (
                    <div className="w-full">
                        <span className={`text-sm text-gray-700 break-words whitespace-normal ${isPending ? 'italic' : ''}`}>
                            {comments}
                        </span>
                    </div>
                )
            },
        }] : []),
        // Show status for pending reviews, EDIT button for completed reviews
        ...(type === 'pending' ? [{
            accessorKey: "status",
            header: ({ column }: { column: Column<Review> }) => {
                return (
                    <div className="flex items-center gap-2">
                        <span>Status</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    A-Z
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    Z-A
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
            cell: ({ row }: { row: Row<Review> }) => {
                const status = row.original.status
                return (
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </div>
                )
            },
        }] : []),
        // Only show review button for pending reviews (FUTURE: && isMembershipActive when reviewer membership enforced)
        ...(type === 'pending' ? [{
            id: "actions",
            header: "",
            cell: ({ row }: { row: Row<Review> }) => {
                const review = row.original
                const patientNameSlug = review.patientName.toLowerCase().replace(/\s+/g, '')
                const submittedDate = new Date(review.submittedDate).toISOString().split('T')[0]
                const slug = `${patientNameSlug}-${submittedDate}`

                return (
                    <Button
                        onClick={(e) => {
                            e.stopPropagation()
                            // Pass the review data through URL state
                            const reviewData = encodeURIComponent(JSON.stringify(review))
                            router.push(`/platform/review/${slug}?data=${reviewData}`)
                        }}
                        className="bg-accent text-white hover:bg-accent/90"
                        size="sm"
                    >
                        <UserPen
                            className="h-4 w-4"
                        />
                    </Button>
                )
            },
        }] : [])
    ]

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination,
            globalFilter,
        },
        getRowId: (row) => row.id,
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        globalFilterFn: (row, columnId, filterValue) => {
            const searchValue = filterValue.toLowerCase()
            const patientName = row.original.patientName?.toLowerCase() || ""
            const patientEmail = row.original.patientEmail?.toLowerCase() || ""
            const status = row.original.status?.toLowerCase() || ""
            const exerciseId = row.original.exerciseType;
            const exercise = exerciseId ? exercises.find(e => e.id === exerciseId) : null;
            const exerciseName = exercise?.name?.toLowerCase() || ""

            const searchFields = [
                patientName,
                patientEmail,
                status,
                exerciseName
            ]

            // Only include comments in search for completed reviews
            if (type === 'completed') {
                const comments = row.original.comments?.toLowerCase() || ""
                searchFields.push(comments)
            }

            return searchFields.some(field => field.includes(searchValue))
        },
    })

    return (
        <div className="w-full mt-5">
            {/* Mobile Layout - Button above search */}
            <div className="block lg:hidden">
                <div className="flex flex-col gap-4 my-6">
                    <div className="relative w-full">
                        <Input
                            placeholder={`Search ${type === 'pending' ? 'pending' : 'completed'} reviews`}
                            className="pr-8"
                            icon={<Search className="size-4" />}
                            iconPosition="left"
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                        />
                        {globalFilter && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                                onClick={() => setGlobalFilter("")}
                            >
                                <X className="size-4" />
                                <span className="sr-only">Clear search</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Desktop Layout - Search and button side by side */}
            <div className="hidden lg:flex items-center justify-between gap-2 my-6">
                <div className="relative w-full max-w-sm">
                    <Input
                        placeholder={`Search ${type === 'pending' ? 'pending' : 'completed'} reviews`}
                        className="pr-8"
                        icon={<Search className="size-4" />}
                        iconPosition="left"
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                    {globalFilter && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                            onClick={() => setGlobalFilter("")}
                        >
                            <X className="size-4" />
                            <span className="sr-only">Clear search</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="block lg:hidden">
                <div className="space-y-4">
                    {table.getRowModel().rows.map((row) => {
                        const review = row.original
                        const isPending = review.status === 'pending'
                        return (
                            <div
                                key={row.id}
                                onClick={onRowClick ? () => onRowClick(review) : undefined}
                                className="bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            >
                                {/* Top Row - Patient and Rating */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-gray-500">Patient</span>
                                        <span className="font-medium text-gray-900">
                                            {review.patientName}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {review.patientEmail}
                                        </span>
                                    </div>
                                    {type === 'completed' && (
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm text-gray-500">Rating</span>
                                            <div className="mt-1">
                                                {renderStars(review.rating)}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Exercise Type Row */}
                                <div className="mb-3">
                                    <span className="text-sm text-gray-500">Exercise Type</span>
                                    <div className="mt-1">
                                        <span className="text-sm text-gray-600">
                                            {review.exerciseType ? exercises.find(e => e.id === review.exerciseType)?.name || 'N/A' : 'N/A'}
                                        </span>
                                    </div>
                                </div>

                                {/* Middle Row - Review/Edit Button */}
                                {type === 'pending' && (
                                    <div className="mb-3">
                                        <div className="mt-1">
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    const patientNameSlug = review.patientName.toLowerCase().replace(/\s+/g, '')
                                                    const submittedDate = new Date(review.submittedDate).toISOString().split('T')[0]
                                                    const slug = `${patientNameSlug}-${submittedDate}`
                                                    // Pass the review data through URL state
                                                    const reviewData = encodeURIComponent(JSON.stringify(review))
                                                    router.push(`/platform/review/${slug}?data=${reviewData}`)
                                                }}
                                                className="bg-main text-white hover:bg-main/90 w-full"
                                                size="sm"
                                            >
                                                REVIEW
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Bottom Row - Status and Date */}
                                <div className="flex flex-col">
                                    <div className="mb-3">
                                        <span className="text-sm text-gray-500">Status</span>
                                        <div className="mt-1">
                                            <span className={`px-2 py-1 text-xs rounded-full ${review.status === 'completed'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">
                                            {type === 'pending' ? 'Submitted' : 'Reviewed'}
                                        </span>
                                        <div className="mt-1">
                                            <span className="text-sm text-gray-700">
                                                {new Date(type === 'pending' ? review.submittedDate : review.reviewDate!).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block">
                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader className="bg-secondary text-white sticky top-0 z-10">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-secondary text-white">
                                    {headerGroup.headers.map((header) => {
                                        const meta = header.column.columnDef.meta as { className?: string } | undefined;
                                        return (
                                            <TableHead key={header.id} colSpan={header.colSpan} className={`text-white ${meta?.className ?? ""}`}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody className="data-[slot=table-cell]:first:w-8 data-[slot=table-cell]:last:w-2">
                            {table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                                    className="bg-white"
                                >
                                    {row.getVisibleCells().map((cell, index) => {
                                        const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                                        return (
                                        <TableCell
                                            key={cell.id}
                                            className={`${index === row.getVisibleCells().length - 1 ? "text-left w-8" : ""} ${meta?.className ?? ""}`}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    )})}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex w-full items-center justify-end px-4 mt-5">
                <div className="flex w-full items-center gap-8 lg:w-fit">
                    <div className="hidden items-center gap-2 lg:flex">
                        <Label htmlFor="rows-per-page" className="text-sm font-medium">
                            Rows per page
                        </Label>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value))
                            }}
                        >
                            <SelectTrigger size="sm" className="w-20 bg-white" id="rows-per-page">
                                <SelectValue
                                    placeholder={table.getState().pagination.pageSize}
                                />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex w-fit items-center justify-center text-sm font-medium">
                        Page {table.getState().pagination.pageIndex + 1} of {""}
                        {table.getPageCount()}
                    </div>
                    <div className="ml-auto flex items-center gap-2 lg:ml-0">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to first page</span>
                            <ChevronsLeft />
                        </Button>
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to previous page</span>
                            <ChevronLeft />
                        </Button>
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to next page</span>
                            <ChevronRight />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to last page</span>
                            <ChevronsRight />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ReviewTable 