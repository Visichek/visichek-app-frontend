import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyMajor } from "@/lib/utils/format-currency";
import type { PlanDistribution } from "@/types/dashboard";

interface AdminPlanDistributionTableProps {
  rows: PlanDistribution[];
}

/**
 * Top 20 plans by subscriber count. Shows plan name, tier, subscribers, and
 * monthly + yearly revenue — the data behind plan-mix decisions and price
 * changes. Both revenue columns are floats in major units.
 */
export function AdminPlanDistributionTable({
  rows,
}: AdminPlanDistributionTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plan distribution</CardTitle>
        <CardDescription>
          Top 20 plans by subscriber count
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {rows.length === 0 ? (
          <EmptyState title="No plans yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead className="hidden md:table-cell">Tier</TableHead>
                  <TableHead className="text-right">Subscribers</TableHead>
                  <TableHead className="hidden md:table-cell text-right">
                    Monthly
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-right">
                    Yearly
                  </TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.planId}>
                    <TableCell className="font-medium">
                      {row.planName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell capitalize text-muted-foreground">
                      {row.planTier}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.subscriberCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatCurrencyMajor(row.monthlyRevenue)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right tabular-nums">
                      {formatCurrencyMajor(row.yearlyRevenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.percentage.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
