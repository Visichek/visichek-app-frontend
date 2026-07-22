import { format, fromUnixTime } from "date-fns";
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
import type { TenantBriefRow } from "@/types/dashboard";

interface AdminTenantBriefTableProps {
  title: string;
  description?: string;
  rows: TenantBriefRow[];
  /** Header for the activity column. Defaults to "Visitors". */
  activityHeader?: string;
  emptyTitle?: string;
}

/**
 * Tabular view of `TenantBriefRow[]` — used for both `recentTenantSignups`
 * (lifetime visitors) and `recentlyActiveTenants` (30-day check-ins). The
 * activity column header is the only thing that differs between them.
 */
export function AdminTenantBriefTable({
  title,
  description,
  rows,
  activityHeader = "Visitors",
  emptyTitle = "No organizations yet",
}: AdminTenantBriefTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {rows.length === 0 ? (
          <EmptyState title={emptyTitle} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="hidden md:table-cell">Country</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="text-right">{activityHeader}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {row.companyName}
                        </span>
                        {!row.isActive && (
                          <Badge variant="outline" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {row.countryOfHosting ?? "—"}
                    </TableCell>
                    <TableCell>
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
                      {row.subscriptionStatus ? (
                        <Badge
                          variant={subscriptionVariant(row.subscriptionStatus)}
                          className="capitalize"
                        >
                          {row.subscriptionStatus.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground tabular-nums">
                      {row.dateCreated
                        ? format(fromUnixTime(row.dateCreated), "PP")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.visitorsCount === null ||
                      row.visitorsCount === undefined
                        ? "—"
                        : row.visitorsCount.toLocaleString()}
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
