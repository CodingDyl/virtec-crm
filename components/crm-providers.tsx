'use client'

import { usePathname } from 'next/navigation';
import { DashboardProvider } from "@/contexts/DashboardContext";
import {
  QuotesProvider,
  ProjectsProvider,
  CustomersProvider,
  SubscriptionsProvider,
  ExpensesProvider,
  MaintenanceInvoicesProvider,
} from "@/contexts/DataContexts";

/**
 * The CRM contexts open live Firestore subscriptions across every collection
 * the moment they mount. The client portal is a public route, so it must not
 * mount them: a visitor holding a share link has no business subscribing to
 * every customer, quote and expense in the business. Portal pages receive
 * their data server-side instead.
 */
export function CrmProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith('/portal')) {
    return <>{children}</>;
  }

  return (
    <DashboardProvider>
      <QuotesProvider>
        <ProjectsProvider>
          <CustomersProvider>
            <SubscriptionsProvider>
              <ExpensesProvider>
                <MaintenanceInvoicesProvider>
                  {children}
                </MaintenanceInvoicesProvider>
              </ExpensesProvider>
            </SubscriptionsProvider>
          </CustomersProvider>
        </ProjectsProvider>
      </QuotesProvider>
    </DashboardProvider>
  );
}
