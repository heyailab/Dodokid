import io, sys, re

P = "dodokid/cloudbase/openapi.yaml"
s = io.open(P, encoding="utf-8").read()

# 1) 6 个公开端点补 security: []（operationId 唯一，作为锚点）
PUBLIC = ["sendSmsCode", "verifyCode", "register", "login", "getVersion", "getPrivacyPolicy"]
for op in PUBLIC:
    old = f"      operationId: {op}\n      tags: [Parent]\n"
    old2 = f"      operationId: {op}\n      tags: [Meta]\n"
    if old in s:
        s = s.replace(old, f"      operationId: {op}\n      tags: [Parent]\n      security: []\n", 1)
    elif old2 in s:
        s = s.replace(old2, f"      operationId: {op}\n      tags: [Meta]\n      security: []\n", 1)
    else:
        print(f"[WARN] 未找到 {op} 的插入点", file=sys.stderr)

# 2) 标记 sendSmsCode / verifyCode 为 deprecated（Go 版废弃，改邮箱认证）
s = s.replace(
    "      summary: Send an SMS verification code\n      operationId: sendSmsCode",
    "      summary: Send an SMS verification code (Node-only; DEPRECATED in Go — replaced by email)\n      deprecated: true\n      operationId: sendSmsCode", 1)
s = s.replace(
    "      summary: Verify an SMS code (standalone check)\n      operationId: verifyCode",
    "      summary: Verify an SMS code (Node-only; DEPRECATED in Go — replaced by email)\n      deprecated: true\n      operationId: verifyCode", 1)

# 3) 新增 /parent/auth/refresh（在 /parent/logout 前插入）
PARENT_REFRESH = '''  /parent/auth/refresh:
    post:
      summary: Refresh parent access token
      description: >
        Exchange a valid refresh token for a new access/refresh pair.
        The refresh token is single-use; reusing a consumed one is rejected
        with code 40100. Audience is "app".
      operationId: parentRefresh
      tags: [ParentAuth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refreshToken]
              properties:
                refreshToken: { type: string }
      responses:
        '200':
          description: Tokens refreshed
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Success'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          tokens: { $ref: '#/components/schemas/AuthTokens' }
        '401':
          $ref: '#/components/responses/Error'
  /parent/logout:
'''
assert "  /parent/logout:\n" in s
s = s.replace("  /parent/logout:\n", PARENT_REFRESH, 1)

# 4) 新增 /admin/auth/refresh（在 /admin/auth/logout 前插入）
ADMIN_REFRESH = '''  /admin/auth/refresh:
    post:
      summary: Refresh admin access token
      description: >
        Exchange a valid admin refresh token for a new access/refresh pair.
        Audience is "admin".
      operationId: adminRefresh
      tags: [AdminAuth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refreshToken]
              properties:
                refreshToken: { type: string }
      responses:
        '200':
          description: Tokens refreshed
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Success'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          tokens: { $ref: '#/components/schemas/AuthTokens' }
        '401':
          $ref: '#/components/responses/Error'
  /admin/auth/logout:
'''
assert "  /admin/auth/logout:\n" in s
s = s.replace("  /admin/auth/logout:\n", ADMIN_REFRESH, 1)

io.open(P, "w", encoding="utf-8").write(s)

# 校验：YAML 可解析 + 统计
import yaml
d = yaml.safe_load(s)
ops = []
for path, methods in d["paths"].items():
    for m in methods:
        if m in ("get", "post", "put", "delete", "patch"):
            sec = methods[m].get("security", "INHERIT")
            ops.append((m.upper(), path, sec))
print(f"解析成功。端点总数: {len(ops)}")
public_missing = [(m, p) for m, p, sec in ops if sec == "INHERIT" and p in (
    "/parent/sendSmsCode", "/parent/verifyCode", "/parent/register",
    "/parent/login", "/version", "/privacyPolicy")]
print("公开端点仍缺 security 数:", len(public_missing))
for x in public_missing:
    print("  缺失:", x)
print("含 refresh 的端点:", [(m, p) for m, p, _ in ops if "refresh" in p])
print("deprecated 端点:", [p for p, ms in d["paths"].items() if any('deprecated' in mv for mv in ms.values() if isinstance(mv, dict) and mv.get('deprecated'))])
