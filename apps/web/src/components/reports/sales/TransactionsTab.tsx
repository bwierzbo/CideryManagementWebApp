"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { format } from "date-fns";

interface TransactionsTabProps {
  startDate: string;
  endDate: string;
}

export function TransactionsTab({ startDate, endDate }: TransactionsTabProps) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState<"date" | "revenue" | "quantity">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const limit = 25;

  // Fetch transactions
  const { data, isLoading } = trpc.sales.getTransactions.useQuery(
    {
      startDate,
      endDate,
      search: search || undefined,
      limit,
      offset,
      sortBy,
      sortDir,
    },
    {}
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleSort = (column: "date" | "revenue" | "quantity") => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setOffset(0);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setOffset(0);
  };

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    if (data?.hasMore) {
      setOffset(offset + limit);
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = data?.total ? Math.ceil(data.total / limit) : 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Sales Transactions</CardTitle>
            <CardDescription>
              Detailed list of all sales in the selected period
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : !data?.transactions.length ? (
          <div className="text-center py-12 text-gray-500">
            No transactions found for selected period
            {search && " and search criteria"}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium">
                      <button
                        className="flex items-center gap-1 hover:text-gray-900"
                        onClick={() => handleSort("date")}
                      >
                        Date
                        <ArrowUpDown
                          className={`w-3 h-3 ${sortBy === "date" ? "text-blue-500" : "text-gray-400"}`}
                        />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Product</th>
                    <th className="text-left py-3 px-4 font-medium">Channel</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-right py-3 px-4 font-medium">
                      <button
                        className="flex items-center gap-1 hover:text-gray-900 ml-auto"
                        onClick={() => handleSort("quantity")}
                      >
                        Qty
                        <ArrowUpDown
                          className={`w-3 h-3 ${sortBy === "quantity" ? "text-blue-500" : "text-gray-400"}`}
                        />
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      Unit Price
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <button
                        className="flex items-center gap-1 hover:text-gray-900 ml-auto"
                        onClick={() => handleSort("revenue")}
                      >
                        Total
                        <ArrowUpDown
                          className={`w-3 h-3 ${sortBy === "revenue" ? "text-blue-500" : "text-gray-400"}`}
                        />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-500">
                        {format(new Date(tx.date), "MMM d, yyyy")}
                        <div className="text-xs text-gray-400">
                          {format(new Date(tx.date), "h:mm a")}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{tx.productName}</span>
                        {tx.packageType && tx.packageSizeML && (
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {tx.packageType} {tx.packageSizeML}ml
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            tx.channelName === "Tasting Room"
                              ? "border-green-500 text-green-600"
                              : tx.channelName === "Wholesale/Distributors"
                                ? "border-blue-500 text-blue-600"
                                : tx.channelName === "Online/DTC Shipping"
                                  ? "border-amber-500 text-amber-600"
                                  : tx.channelName === "Events/Farmers Markets"
                                    ? "border-purple-500 text-purple-600"
                                    : ""
                          }
                        >
                          {tx.channelName}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-500 max-w-[150px] truncate">
                        {tx.location}
                      </td>
                      <td className="text-right py-3 px-4">{tx.quantity}</td>
                      <td className="text-right py-3 px-4 text-gray-500">
                        {formatCurrency(tx.pricePerUnit)}
                      </td>
                      <td className="text-right py-3 px-4 font-medium text-green-600">
                        {formatCurrency(tx.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {offset + 1}-{Math.min(offset + limit, data.total)} of{" "}
                {data.total} transactions
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!data.hasMore}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
