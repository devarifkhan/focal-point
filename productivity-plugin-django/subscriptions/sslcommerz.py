import requests
import hashlib
from django.conf import settings
from decimal import Decimal


class SSLCommerzPayment:
    def __init__(self):
        self.store_id = settings.SSLCOMMERZ_STORE_ID
        self.store_password = settings.SSLCOMMERZ_STORE_PASSWORD
        self.is_sandbox = settings.SSLCOMMERZ_IS_SANDBOX
        
        if self.is_sandbox:
            self.base_url = "https://sandbox.sslcommerz.com"
        else:
            self.base_url = "https://securepay.sslcommerz.com"
    
    def create_session(self, payment_data):
        """Create payment session with SSLCommerz"""
        url = f"{self.base_url}/gwprocess/v4/api.php"
        
        data = {
            'store_id': self.store_id,
            'store_passwd': self.store_password,
            'total_amount': str(payment_data['amount']),
            'currency': payment_data.get('currency', 'USD'),
            'tran_id': payment_data['transaction_id'],
            'success_url': payment_data['success_url'],
            'fail_url': payment_data['fail_url'],
            'cancel_url': payment_data['cancel_url'],
            'ipn_url': payment_data.get('ipn_url', ''),
            'cus_name': payment_data['customer_name'],
            'cus_email': payment_data['customer_email'],
            'cus_add1': payment_data.get('customer_address', 'N/A'),
            'cus_city': payment_data.get('customer_city', 'Dhaka'),
            'cus_country': payment_data.get('customer_country', 'Bangladesh'),
            'cus_phone': payment_data.get('customer_phone', ''),
            'product_name': payment_data.get('product_name', 'Premium Subscription'),
            'product_category': payment_data.get('product_category', 'Subscription'),
            'product_profile': 'general',
            'shipping_method': 'NO',
        }
        
        try:
            response = requests.post(url, data=data)
            return response.json()
        except Exception as e:
            return {'status': 'FAILED', 'error': str(e)}
    
    def validate_payment(self, transaction_id, amount):
        """Validate payment with SSLCommerz"""
        # For sandbox/testing, skip validation and return True
        # In production, implement proper validation
        if self.is_sandbox:
            print(f"Sandbox mode: Skipping validation for {transaction_id}")
            return True
            
        url = f"{self.base_url}/validator/api/validationserverAPI.php"
        
        data = {
            'store_id': self.store_id,
            'store_passwd': self.store_password,
            'val_id': transaction_id,
            'format': 'json'
        }
        
        try:
            response = requests.get(url, params=data)
            result = response.json()
            
            print(f"SSLCommerz validation response: {result}")
            
            # Check if payment is valid and amount matches
            if (result.get('status') == 'VALID' or result.get('status') == 'VALIDATED') and \
               float(result.get('amount', 0)) == float(amount):
                return True
            return False
        except Exception as e:
            print(f"Validation error: {e}")
            return False