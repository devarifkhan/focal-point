# API Documentation

1. ## User Register
   - **Endpoint:** /user/register
   - **Method:** POST
   - **Request Body:**

```javascript
    {
        "first_name":"John",
        "last_name":"Doe",
        "email":"johndoe@gmail.com", # It Must Be Unique
        "password":"johndoe@gmail.com" # It Must contain letter,number,special character and 8 character long
    }

```

- **Response**:
  - **200 OK:** On Successful Registertration

```javascript
        {
            "success": true,
            "message": "Success Response",
            "data": {
                "success": "okay"
            },
            "error": null
        }
```

- **400 Bad Request:** 400 Bad Request (If no Strong Password Provided)

```javascript
    {
        "success": true,
        "message": "Failed To Register",
        "data": null,
        "error": "Failed Register User{'password': [ErrorDetail(string=\"['This password is too short. It must contain at least 8 characters.', 'This password is entirely numeric.']\", code='invalid')]}"
    }
```

- **400 Bad Request:** 400 Bad Request (If user email is already registered)

```javascript
    {
        "success": true,
        "message": "Failed To Register",
        "data": null,
        "error": "Failed Register User{'email': [ErrorDetail(string='users with this email already exists.', code='unique')]}"
    }
```

2. ## User login
   - **Endpoint:** /user/login
   - **Method:** POST
   - **Request Body:**

```javascript
    {

        "email":"jondoe@gmail.com",
        "password":"aa@12jhdg"

    }

```

- **Response**:
  - **200 OK:** On Successful Login

```javascript
{
    "success": true,
    "message": "Success Response",
    "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzQsImVtYWlsIjoibWRhc2lmYWhhbWVkZmFoaW1AZ21haWwuY29tIiwiZXhwaXJlIjoiMjAyNC0wOC0wNFQwNTo0Nzo1OS4wMjE3NzkrMDA6MDAifQ.rERm1tq6rJxSTOzfd3uArAWEij7Oxtn8DKcgiPrU3VQ",
        "token_type": "Bearer"
    },
    "error": null
}
```

- **400 Bad Request:** 400 Bad Request (If wrong Password is Given)

```javascript
    {
        "success": true,
        "message": "login/password does not match",
        "data": null,
        "error": "Authentication Failed"
    }
```

- **400 Bad Request:** 400 Bad Request (If user email is not registered)

```javascript
    {
        "success": true,
        "message": "User Does Not Exist",
        "data": null,
        "error": "Invlalid Credential"
    }
```

3. ## Changed User Password While User Is Logged IN
   - **Endpoint:** /user/change_password
   - **Method:** POST
   - **Header**: 'Authorization': 'Bearer ' + token
   - **Request Body:**

```javascript
    {

        "old_password":"jondoe@gmail.com",
        "new_password":"aa@12jhdg"

    }

```

- **Response**:
  - **200 OK:** On Password Changed

```javascript
    {
        "success": true,
        "message": "Success Response",
        "data": {
            "message": "Password Updated"
        },
        "error": null
    }
```

- **400 Bad Request:** 400 Bad Request (If token is not provided)

```javascript
    {
        "success": true,
        "message": "Try Again Later",
        "data": null,
        "error": "An unexpected error occurred 'NoneType' object has no attribute 'split'"
    }
```

- **400 Bad Request:** 400 Bad Request (If Old/Current Does Not Match)

```javascript
    {
        "success": true,
        "message": "Old Password Does Not Match",
        "data": null,
        "error": "Old Password Does Not Match"
    }
```

4. ## Forget Password
   - **Endpoint:** /user/forget_password
   - **Method:** POST
   - **Request Body:**

```javascript
    {
        "email":"mdasifahamedfahim@gmail.com"
    }

```

- **Response**:
  - **200 OK:** On Successful Reset Link Sent

```javascript
    {
        "success": true,
        "message": "Password Reset Link Sent Successfully",
        "data": {},
        "error": null
    }
```

- **400 Bad Request:** 400 Bad Request (If The Given Email Is Not Registered)

```javascript
    {
        "success": true,
        "message": "The email example@gmail.com is not registered",
        "data": null,
        "error": "User Not Exists"
    }
```

- **400 Bad Request:** 400 Bad Request (For Unexpected Error)

```javascript
    {
        "success": true,
        "message": "Try Again Later",
        "data": null,
        "error": "An unexpected error occured as"
    }
```
