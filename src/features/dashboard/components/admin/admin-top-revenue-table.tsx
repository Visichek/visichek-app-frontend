import { Badge, type BadgeProps } from "@/components/ui/badge";
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
import type { TopTenantByRevenue } from "@/types/dashboard";

interface AdminTopRevenueTableProps {
  rows: TopTenantByRevenue[];
}

/**
 * Top 10 tenants by `monthly + yearly/12`. Used in the admin revenue panel —
 * surfaces both revenue legs plus the plan/tier and current subscription
 * status so the platform team can spot churn risk on top accounts.
 */
export function AdminTopRevenueTable({ rows }: AdminTopRevenueTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top organizations by revenue</CardTitle>
        <CardDescription>
          Ranked by monthly equivalent (monthly + yearly / 12)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {rows.length === 0 ? (
          <EmptyState title="No revenue yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="hidden md:table-cell">Plan</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">
                    Yearly
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.tenantId}>
                    <TableCell className="font-medium">
                      {row.companyName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.planName ? (
                        <div className="flex flex-col">
                          <span className="text-sm">{row.planName}</span>
                          {row.planTier && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {row.planTier}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.status ? (
                        <Badge
                          variant={subscriptionVariant(row.status)}
                          className="capitalize"
                        >
                          {row.status.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyMajor(row.monthlyRevenue)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right tabular-nums">
                      {formatCurrencyMajor(row.yearlyRevenue)}
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

function subscriptionVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "active":
      return "success";
    case "trialing":
      return "info";
    case "past_due":
      return "warning";
    case "suspended":
    case "expired":
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}
