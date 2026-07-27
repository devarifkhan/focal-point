from rest_framework import status
from rest_framework.response import Response


class BaseController:
    response = {
        "success": True,
        "message": "",
        "data": None,
        "error": None,
        "status_code": None,
        "code": None,
    }

    def success_res(
        self,
        data={},
        message="Success Response",
        status_code=status.HTTP_200_OK,
        code=None,
        **kwargs
    ):
        self.response = {
            **self.response,
            "data": data,
            "message": message,
            "status_code": status_code,
            "code": code,
        }
        return Response(data=self.response, status=status_code)

    def error_res(
        self,
        error,
        message="Error Response",
        status_code=status.HTTP_400_BAD_REQUEST,
        code=None,
        **kwargs
    ):
        self.response = {
            **self.response,
            "error": error,
            "message": message,
            "status_code": status_code,
            "code": code,
        }
        return Response(data=self.response, status=status_code)
