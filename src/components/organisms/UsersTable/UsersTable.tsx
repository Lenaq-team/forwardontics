"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Search,
  X
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
// import { CondicionesDetail } from "@/components"

interface User {
  username: string;
  email: string;
  role: string;
  attributes: Record<string, string>;
  userStatus: string;
  enabled: boolean;
  userCreateDate: string;
  lastModifiedDate: string;
  sub: string;
  birthdate: string;
  picture: string;
  emailVerified: boolean;
  name: string;
  family_name: string;
}

const UsersTable = ({
  data,
  onRowClick,
  onDataRefresh,
}: {
  data: User[];
  onRowClick?: (user: User) => void;
  onDataRefresh?: () => void;
}) => {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [dialogStates, setDialogStates] = useState<Record<string, { isOpen: boolean; action: string | null }>>({})
  const [openDialogNewClient, setOpenDialogNewClient] = useState<boolean>(false)

  // Template for new user
  const newUserTemplate: User = {
    username: '',
    email: '',
    role: 'User',
    attributes: {},
    userStatus: 'UNCONFIRMED',
    enabled: true,
    userCreateDate: new Date().toISOString(),
    lastModifiedDate: new Date().toISOString(),
    sub: '',
    birthdate: '',
    picture: '',
    emailVerified: false,
    name: '',
    family_name: '',
  }

  const handleDialogOpen = (userId: string, action: string) => {
    setDialogStates(prev => ({
      ...prev,
      [userId]: { isOpen: true, action }
    }))
  }

  const handleDialogClose = (userId: string) => {
    setDialogStates(prev => ({
      ...prev,
      [userId]: { isOpen: false, action: null }
    }))
  }

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex flex-col">
            <span className="font-medium">{user.name} {user.family_name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Email</span>
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
        return (
          <div className="flex items-center gap-2">
            <span>{row.original.email}</span>
            {row.original.emailVerified && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                Verified
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Role</span>
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
        return row.original.role
      },
    },
    {
      accessorKey: "birthdate",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Birthdate</span>
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
                  Ascending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Descending
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      cell: ({ row }) => {
        return row.original.birthdate || '-'
      },
    },
    {
      accessorKey: "userStatus",
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
                  Ascending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Descending
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      cell: ({ row }) => {
        const status = row.original.userStatus
        const enabled = row.original.enabled
        return (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded-full ${status === 'CONFIRMED' && enabled
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
              }`}>
              {status}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${enabled ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
              }`}>
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "userCreateDate",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Created</span>
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
                  Ascending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Descending
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      cell: ({ row }) => {
        return new Date(row.original.userCreateDate).toLocaleDateString('en-US')
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const userId = row.original.username
        const dialogState = dialogStates[userId] || { isOpen: false, action: null }

        return (
          <Dialog
            open={dialogState.isOpen}
            onOpenChange={() => handleDialogClose(userId)}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="data-[state=open]:bg-neutral-100 text-neutral-500 flex size-8 dark:data-[state=open]:bg-neutral-800 dark:text-neutral-400 w-fit p-0"
                  size="icon"
                >
                  <MoreVertical />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => handleDialogOpen(userId, 'edit')}>
                  Edit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* <UserDetail user={row.original} closeDialog={() => handleDialogClose(userId)} onDataRefresh={onDataRefresh} /> */}
          </Dialog>
        )
      },
    },
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
    getRowId: (row) => row.username,
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
      const email = row.getValue("email")?.toString().toLowerCase() || ""
      const role = row.getValue("role")?.toString().toLowerCase() || ""
      const name = row.original.name?.toLowerCase() || ""
      const familyName = row.original.family_name?.toLowerCase() || ""
      const username = row.original.username?.toLowerCase() || ""

      return email.includes(searchValue) ||
        role.includes(searchValue) ||
        name.includes(searchValue) ||
        familyName.includes(searchValue) ||
        username.includes(searchValue)
    },
  })


  return (
    <div className="w-full mt-5">
      {/* Mobile Layout - Button above search */}
      <div className="block lg:hidden">
        <div className="flex flex-col gap-4 my-6">
          <Dialog open={openDialogNewClient} onOpenChange={setOpenDialogNewClient}>
            <DialogTrigger asChild>
              <Button
                className="flex items-center gap-2 bg-accent w-full text-white"
              >
                <Plus />
                New user
              </Button>
            </DialogTrigger>
            {/* <UserDetail
              user={newUserTemplate}
              closeDialog={() => setOpenDialogNewClient(false)}
              onDataRefresh={onDataRefresh}
              initialEditingState={true}
            /> */}
          </Dialog>
          <div className="relative w-full">
            <Input
              placeholder="Search by name, email, or role"
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
            placeholder="Search by name, email, or role"
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
        <Dialog open={openDialogNewClient} onOpenChange={setOpenDialogNewClient}>
          <DialogTrigger asChild>
            <Button
              className="flex items-center gap-2 bg-accent w-[180px] text-white"
            >
              <Plus />
              New user
            </Button>
          </DialogTrigger>
          {/* <UserDetail
            user={newUserTemplate}
            closeDialog={() => setOpenDialogNewClient(false)}
            onDataRefresh={onDataRefresh}
            initialEditingState={true}
          /> */}
        </Dialog>
      </div>
      {/* Mobile Card View */}
      <div className="block lg:hidden">
        <div className="space-y-4">
          {table.getRowModel().rows.map((row) => {
            const user = row.original
            return (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(user) : undefined}
                className="bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Top Row - Name and Role */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Name</span>
                    <span className="font-medium text-gray-900">
                      {user.name} {user.family_name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm text-gray-500">Role</span>
                    <span className="font-medium text-gray-900 mt-1">
                      {user.role}
                    </span>
                  </div>
                </div>

                {/* Middle Row - Email and Verification */}
                <div className="mb-3">
                  <span className="text-sm text-gray-500">Email</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-700">{user.email}</span>
                    {user.emailVerified && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row - Status and Created Date */}
                <div className="flex flex-col">
                  <div className="mb-3">
                    <span className="text-sm text-gray-500">Status</span>
                    <div className="flex gap-2 mt-1">
                      <span className={`px-2 py-1 text-xs rounded-full ${user.userStatus === 'CONFIRMED' && user.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {user.userStatus}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${user.enabled ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {user.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Created</span>
                    <div className="mt-1">
                      <span className="text-sm text-gray-700">
                        {new Date(user.userCreateDate).toLocaleDateString('en-US')}
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
    </div>
  )
}

export default UsersTable