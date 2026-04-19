import os
from dotenv import load_dotenv
from NorenRestApiPy.NorenApi import NorenApi
import pyotp
import requests

# Monkey-patch requests.post to intercept the raw response
original_post = requests.post

def debug_post(*args, **kwargs):
    print(f"\n[DEBUG] POST to: {args[0]}")
    res = original_post(*args, **kwargs)
    print(f"[DEBUG] Status: {res.status_code}")
    print(f"[DEBUG] Response Text: {res.text[:500]}") # print first 500 chars
    return res

requests.post = debug_post

load_dotenv()

api = NorenApi(
    host="https://api.shoonya.com/NorenWClientTP/",
    websocket="wss://api.shoonya.com/NorenWSTP/"
)

uid = os.getenv("SHOONYA_USER_ID")
pwd = os.getenv("SHOONYA_PASSWORD")
totp_secret = os.getenv("SHOONYA_TOTP_SECRET")
vc = os.getenv("SHOONYA_VENDOR_CODE")
api_key = os.getenv("SHOONYA_API_KEY")

print(f"User ID: {uid}")
print(f"Vendor Code: {vc}")

totp = pyotp.TOTP(totp_secret).now()
print(f"Generated TOTP: {totp}")

try:
    ret = api.login(
        userid=uid,
        password=pwd,
        twoFA=totp,
        vendor_code=vc,
        api_secret=api_key,
        imei="abc1234"
    )
    print("Login success:", ret)
except Exception as e:
    print("Exception during login:", type(e).__name__, e)
