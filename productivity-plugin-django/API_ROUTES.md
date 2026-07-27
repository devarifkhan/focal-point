# API Routes Documentation

## User Management
- `POST /user/register` - User registration (creates USER role by default)
- `POST /user/login` - User login
- `POST /user/logout` - User logout
- `POST /user/forgot_password` - Request password reset
- `POST /user/reset_password` - Reset password
- `POST /user/verify_email` - Verify email address

## URL Management
- `POST /urls/add` - Add a new URL to block
- `GET /urls/retrive_urls_list/` - Get all URLs for user
- `DELETE /urls/delete_url/<id>` - Delete a URL
- `PUT /urls/update_url/<id>` - Update a URL
- `PUT /urls/reset_time/<id>` - Reset URL time
- `PUT /urls/add_calender_url/<id>` - Add calendar URL
- `PUT /urls/active_deactivate_url/<id>` - Toggle URL active status

## Scheduling & Timezone
- `GET /urls/scheduled-tasks/` - View scheduled reset tasks
- `PUT /urls/update-timezone/` - Update user timezone
- `POST /urls/manual-reset/` - Manually trigger URL reset

## Analytics & Dashboard
### User Analytics (USER role)
- `GET /urls/analytics/?period=7` - Get user analytics (7 or 30 days only)
- `GET /analytics/dashboard/?period=7` - Get user dashboard data (7 or 30 days only)

### Admin Analytics (ADMIN role only)
- `GET /analytics/admin/overview/` - Get full system analytics overview (no time limits)

## Subscription Management
- `GET /subscriptions/retrive_subcription_info` - Get user subscription info
- `GET /subscriptions/subscriptions_plan_list` - List all subscription plans
- `PUT /subscriptions/subscriptions_plan_update` - Update subscription plan
- `GET /subscriptions/plan_config` - Get plan configuration from env variables

## Payment (SSLCommerz)
### User Payment (USER role)
- `POST /subscriptions/initiate-payment/` - Start payment process
- `GET /subscriptions/my-payments/` - Get user's own payment history

### Admin Payment (ADMIN role only)
- `GET /subscriptions/admin/payments/` - Get all users payment details and analytics

### Payment Callbacks (No auth required)
- `POST /subscriptions/payment-callback/` - Unified payment callback with status parameter
  - Parameters: `status` (success/failed/cancel), `tran_id`, `amount`

## WebSocket Endpoints
- `ws://localhost:8000/ws/urls/list/<user_id>/` - Real-time URL list updates
- `ws://localhost:8000/ws/urls/update/<url_id>/` - Real-time URL updates

## Roles & Permissions

### USER (Default for all registrations)
- **Own data access only**: URLs, analytics, payments
- **Time-limited analytics**: 7 or 30 days period restriction
- **Personal dashboard**: Individual metrics and statistics
- **Own payment history**: Can view only their transactions

### ADMIN (Created via seeder only)
- **System-wide access**: All users data and system overview
- **Unlimited analytics**: Full historical data, no time restrictions
- **All payment data**: Complete transaction history for all users
- **System statistics**: Users count, revenue, conversion rates
- **Full dashboard**: System health and performance metrics

## Admin Management

### Create Admin User
```bash
python manage.py create_admin
```

### Default Admin Credentials
- **Email**: admin@focusly.pro
- **Password**: admin123
- **Role**: ADMIN
- **Plan**: PAID (365 days, unlimited URLs)

### Admin Features
- View all users payment details with revenue analytics
- Access complete system overview without time restrictions
- Monitor system-wide statistics and performance
- Full historical data access for all users

## Authentication
All endpoints except registration, login, and payment callbacks require:
```
Authorization: Bearer <jwt_token>
```

## Access Control
- **403 Forbidden**: Returned when USER tries to access ADMIN endpoints
- **401 Unauthorized**: Returned when token is missing/expired
- **Role validation**: Automatic role checking on protected endpoints

## Query Parameters
- `period` - For USER analytics endpoints only (7 or 30 days)
- Default period is 7 days if not specified
- ADMIN endpoints ignore period parameter (full access)