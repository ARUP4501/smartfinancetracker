import requests

# Assuming dev server is running on 127.0.0.1:5000
try:
    # First login as admin
    res = requests.post("http://127.0.0.1:5000/api/auth/admin/login", json={"email": "admin@gmail.com", "password": "Admin123!"})
    cookies = res.cookies
    print("Login status:", res.status_code)
    
    # Toggle maintenance
    res2 = requests.post("http://127.0.0.1:5000/api/admin/maintenance", json={"enabled": True}, cookies=cookies)
    print("Toggle status:", res2.status_code)
    print("Toggle response:", res2.content.decode('utf-8'))
except Exception as e:
    print(e)
