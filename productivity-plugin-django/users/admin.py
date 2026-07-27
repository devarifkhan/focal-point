from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from users.models import User

class UsersAdmin(UserAdmin):

    def group(self, user):
        groups = []
        for group in user.groups.all():
            groups.append(group.name)
        return ', '.join(groups)


    add_fieldsets = (
            ("User Information", {
                'classes': ('wide',),
                'fields': ("first_name", "last_name", "email", "groups", "password", "is_active", "is_staff")}
            ),
        )
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    list_display = ('email', 'first_name', 'is_active', 'is_staff', 'group')
    readonly_fields = ('email', 'first_name','date_joined')
    ordering = ('first_name',)
    list_display_links = ('first_name','email')
    list_filter = ['groups', 'is_active', 'is_staff']
    search_fields = ( 'first_name', 'last_name', 'email')


    def has_add_permission(self, request):
        if request.user.is_superuser:
            return True
        return False

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return False

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser or request.user.is_staff:
            return True
        return False
    

admin.site.register(User,UsersAdmin)


