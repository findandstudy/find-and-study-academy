import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { ShoppingCart, CreditCard, AlertCircle } from 'lucide-react';

const statusColors = {
  unpaid: 'destructive',
  pending: 'secondary',
  paid: 'default',
  failed: 'destructive',
  refunded: 'secondary'
} as const;

const statusColorClasses = {
  unpaid: '',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: '',
  refunded: ''
};

export default function AgentExamsOrders() {
  const { user } = useAuthStore();
  const { orders, paymentConfig } = useDataStore();

  const userOrders = orders.filter(o => o.userId === user?.id);

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Exams & Orders
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage your exam registrations and payment history.
          </p>
        </div>
      </div>

      {/* Payment Status Banner */}
      {!paymentConfig.enabled && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Payments Coming Soon</p>
                <p className="text-sm text-yellow-700">
                  All courses and exams are currently free while we set up payment processing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userOrders.map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{order.title}</h3>
                      <Badge variant={statusColors[order.status]} className={statusColorClasses[order.status]}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span>Order #{order.id}</span>
                      <span>{order.amount} {order.currency}</span>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {order.status === 'unpaid' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Button
                              size="sm"
                              disabled={!paymentConfig.enabled}
                              data-testid={`button-pay-${order.id}`}
                            >
                              <CreditCard className="w-4 h-4 mr-2" />
                              Pay Now
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {paymentConfig.enabled 
                            ? 'Click to pay for this order' 
                            : 'Payments are not enabled yet'
                          }
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}