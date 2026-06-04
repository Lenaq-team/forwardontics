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
    Plus,
    X,
    Star,
    Play
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
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ProxyVideo } from "@/components/atoms/ProxyVideo"
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
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { exercises } from "@/lib/data/exercises"


interface Video {
    id: string;
    date: string;
    rating: number | null;
    comments: string;
    duration: string;
    status: 'pending' | 'reviewed' | 'approved';
    exerciseType?: number;
    bucket?: string;
    key?: string;
}

const VideoTable = ({
    data,
    onRowClick,
    onDataRefresh,
}: {
    data: Video[];
    onRowClick?: (video: Video) => void;
    onDataRefresh?: () => void;
}) => {
    const [rowSelection, setRowSelection] = React.useState({})
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({})
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
    )
    const [sorting, setSorting] = React.useState<SortingState>([
        {
            id: "date",
            desc: true
        }
    ])
    const [globalFilter, setGlobalFilter] = React.useState("")
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: 10,
    })
    const [openDialogNewVideo, setOpenDialogNewVideo] = React.useState(false)
    const [videoToWatch, setVideoToWatch] = React.useState<Video | null>(null)

    const getVideoUrl = (video: Video) => {
        if (!video.key) return null;
        const params = new URLSearchParams({ key: video.key });
        if (video.bucket) params.set("bucket", video.bucket);
        return `/api/videos/proxy?${params.toString()}`;
    };


    const renderStars = (rating: number | null) => {
        if (rating === null) {
            return <span className="text-sm text-gray-500">Review pending</span>
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



    const columns: ColumnDef<Video>[] = [
        {
            accessorKey: "exerciseType",
            header: ({ column }) => {
                return (
                    <div className="flex items-center gap-2">
                        <span>Exercise Type</span>
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
                const exerciseId = row.original.exerciseType;
                const exercise = exerciseId ? exercises.find(e => e.id === exerciseId) : null;
                return (
                    <div className="text-sm text-gray-600 italic">
                        {exercise ? exercise.name : 'N/A'}
                    </div>
                )
            },
            sortingFn: (rowA, rowB) => {
                const exerciseA = rowA.original.exerciseType ? exercises.find(e => e.id === rowA.original.exerciseType)?.name || '' : 'N/A';
                const exerciseB = rowB.original.exerciseType ? exercises.find(e => e.id === rowB.original.exerciseType)?.name || '' : 'N/A';
                return exerciseA.localeCompare(exerciseB);
            },
            filterFn: (row, id, value) => {
                if (!value || value.length === 0) return true;
                const exerciseId = row.original.exerciseType;
                const exercise = exerciseId ? exercises.find(e => e.id === exerciseId) : null;
                const exerciseName = exercise?.name || 'N/A';
                return value.includes(exerciseName);
            },
        },
        {
            accessorKey: "duration",
            header: "Duration",
            cell: ({ row }) => {
                return (
                    <div className="text-sm text-gray-600">
                        {row.original.duration}
                    </div>
                )
            },
        },
        {
            accessorKey: "date",
            header: ({ column }) => {
                return (
                    <div className="flex items-center gap-2">
                        <span>Date</span>
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
                return new Date(row.original.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })
            },
        },
        {
            accessorKey: "rating",
            header: ({ column }) => {
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
            cell: ({ row }) => {
                return renderStars(row.original.rating)
            },
        },
        {
            accessorKey: "comments",
            header: "Comments",
            cell: ({ row }) => {
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
        },
        {
            accessorKey: "status",
            header: ({ column }) => {
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
            cell: ({ row }) => {
                const status = row.original.status
                return (
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${status === 'reviewed' || status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {status === 'approved' ? 'Reviewed' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                const video = row.original;
                const url = getVideoUrl(video);
                return (
                    <Button
                        size="icon"
                        className="h-8 w-8 bg-accent hover:bg-accent/80 text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (url) setVideoToWatch(video);
                        }}
                        disabled={!url}
                    >
                        <Play className="h-4 w-4" />
                    </Button>
                );
            },
        }
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
            const comments = row.original.comments?.toLowerCase() || ""
            const status = row.original.status?.toLowerCase() || ""
            const exerciseId = row.original.exerciseType;
            const exercise = exerciseId ? exercises.find(e => e.id === exerciseId) : null;
            const exerciseName = exercise?.name?.toLowerCase() || ""

            return comments.includes(searchValue) ||
                status.includes(searchValue) ||
                exerciseName.includes(searchValue)
        },
    })

    // Get unique exercise types for filter
    const exerciseTypeFilter = React.useMemo(() => {
        const uniqueExerciseIds = Array.from(new Set(data.map(v => v.exerciseType).filter(Boolean))) as number[];
        return uniqueExerciseIds.map(id => {
            const exercise = exercises.find(e => e.id === id);
            return { id, name: exercise?.name || 'N/A' };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [data]);

    const selectedExerciseFilter = columnFilters.find(f => f.id === 'exerciseType')?.value as string[] || [];

    return (
        <div className="w-full mt-5">
            <div className="flex items-center justify-between gap-2 my-6">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative w-full max-w-sm">
                        <Input
                            placeholder="Search by exercise, comments or status"
                            className="pr-8"
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
                    <Select
                        value={selectedExerciseFilter.length > 0 ? selectedExerciseFilter[0] : "all"}
                        onValueChange={(value) => {
                            if (value === "all") {
                                setColumnFilters(prev => prev.filter(f => f.id !== 'exerciseType'));
                            } else {
                                setColumnFilters(prev => {
                                    const filtered = prev.filter(f => f.id !== 'exerciseType');
                                    return [...filtered, { id: 'exerciseType', value: [value] }];
                                });
                            }
                        }}
                    >
                        <SelectTrigger className="w-[200px] bg-white">
                            <SelectValue placeholder="Filter by exercise" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Exercises</SelectItem>
                            {exerciseTypeFilter.map((exercise) => (
                                <SelectItem key={exercise.id} value={exercise.name}>
                                    {exercise.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {/* <Dialog open={openDialogNewVideo} onOpenChange={setOpenDialogNewVideo}>
                    <DialogTrigger asChild>
                        <Button
                            className="flex items-center gap-2 bg-accent w-[180px] text-white"
                            onClick={() => window.location.href = '/platform/recordvideo'}
                        >
                            <Plus />
                            New Video
                        </Button>
                    </DialogTrigger>
                </Dialog> */}
            </div>

            {/* Mobile Card View */}
            <div className="block lg:hidden">
                <div className="space-y-4">
                    {table.getRowModel().rows.map((row) => {
                        const video = row.original
                        const isPending = video.status === 'pending'
                        return (
                            <div
                                key={row.id}
                                onClick={onRowClick ? () => onRowClick(video) : undefined}
                                className="bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            >
                                {/* Exercise Type + See video button */}
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="text-sm text-gray-500">Exercise Type</span>
                                        <div className="mt-1">
                                            <span className="text-sm text-gray-600 italic">
                                                {video.exerciseType ? exercises.find(e => e.id === video.exerciseType)?.name || 'N/A' : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                    {getVideoUrl(video) && (
                                        <Button
                                            size="icon"
                                            className="h-10 w-10 shrink-0 bg-accent hover:bg-accent/80 text-white"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setVideoToWatch(video);
                                            }}
                                        >
                                            <Play className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>

                                {/* Top Row - Date, Duration, and Rating */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-gray-500">Date</span>
                                        <span className="font-medium text-gray-900">
                                            {new Date(video.date).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm text-gray-500">Duration</span>
                                        <span className="text-sm text-gray-600">
                                            {video.duration}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-sm text-gray-500">Rating</span>
                                        <div className="mt-1">
                                            {renderStars(video.rating)}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Row - Status and Comments */}
                                <div className="flex flex-col">
                                    <div className="mb-3">
                                        <span className="text-sm text-gray-500">Status</span>
                                        <div className="mt-1">
                                            <span className={`px-2 py-1 text-xs rounded-full ${video.status === 'reviewed' || video.status === 'approved'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {video.status === 'approved' ? 'Reviewed' : video.status.charAt(0).toUpperCase() + video.status.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">Comments</span>
                                        <div className="mt-1">
                                            <span className={`text-sm text-gray-700 break-words ${isPending ? 'italic' : ''}`}>
                                                {video.comments}
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
                                        return (
                                            <TableHead key={header.id} colSpan={header.colSpan} className="text-white">
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
                                    {row.getVisibleCells().map((cell, index) => (
                                        <TableCell
                                            key={cell.id}
                                            className={index === row.getVisibleCells().length - 1 ? "text-left w-8" : ""}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
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

            <Dialog open={!!videoToWatch} onOpenChange={(open) => !open && setVideoToWatch(null)}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            {videoToWatch && videoToWatch.exerciseType
                                ? exercises.find((e) => e.id === videoToWatch.exerciseType)?.name ?? "Video"
                                : "Video"}
                        </DialogTitle>
                    </DialogHeader>
                    {videoToWatch && getVideoUrl(videoToWatch) && (
                        <ProxyVideo
                            src={getVideoUrl(videoToWatch)!}
                            controls
                            className="w-full aspect-video rounded-lg"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default VideoTable 