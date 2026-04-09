"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import { useAuth } from "@/hooks/use-auth";
import { apiGet } from "@/lib/api/request";
import type { Tenant } from "@/types/tenant";
import { ApiError } from "@/types/api";
import { toast } from "sonner";

export default function SelectTenantPage() {
  const { loginSuperAdminTenant } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTenantId, setLoadingTenantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    const filtered = tenants.filter((tenant) =>
      tenant.companyName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredTenants(filtered);
  }, [searchQuery, tenants]);

  async function fetchTenants() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<Tenant[]>("/tenants");
      setTenants(data);
      setFilteredTenants(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load tenants. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectTenant(tenantId: string) {
    setLoadingTenantId(tenantId);
    try {
      await loginSuperAdminTenant(tenantId);
    } catch (err) {
      setLoadingTenantId(null);
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to select tenant. Please try again.");
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading tenants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4">
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
          <Button onClick={fetchTenants} variant="outline" className="w-full">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-display font-bold">Select a Tenant</h1>
          <p className="mt-2 text-muted-foreground">
            Choose a workspace to manage
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-8 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tenant cards grid */}
        {filteredTenants.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTenants.map((tenant) => (
              <div
                key={tenant.Id}
                className="group relative rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
              >
                {/* Logo area */}
                {tenant.companyName && (
                  <div className="mb-4 h-12 w-full flex items-center justify-center rounded bg-muted">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {tenant.companyName.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Tenant name */}
                <h3 className="mb-2 line-clamp-2 text-lg font-semibold">
                  {tenant.companyName}
                </h3>

                {/* Tenant ID */}
                <p className="mb-4 text-xs text-muted-foreground">{tenant.Id}</p>

                {/* Select button */}
                <LoadingButton
                  onClick={() => handleSelectTenant(tenant.Id)}
                  isLoading={loadingTenantId === tenant.Id}
                  loadingText="Switching..."
                  className="w-full"
                  size="sm"
                >
                  Select
                </LoadingButton>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "No tenants match your search."
                : "No tenants available."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
