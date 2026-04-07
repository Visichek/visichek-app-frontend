import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">VisiChek</h1>
          <p className="mt-2 text-sm text-gray-600">
            Visitor Management System
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Administration</CardTitle>
              <CardDescription>
                Manage tenants, plans, and system settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/login">
                <Button className="w-full">
                  Admin Login
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tenant Portal</CardTitle>
              <CardDescription>
                Access your organization's visitor management system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/app/login">
                <Button variant="outline" className="w-full">
                  Tenant Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}