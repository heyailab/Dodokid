#!/bin/bash
# 校验构建出的 APK 内部 JS bundle 里的后端地址与 Mock 开关。
# 用途：证明「装上去的包连的是真实服务器」，而不是只信配置文件。
# 用法：bash verify_apk.sh <apk路径>
set -uo pipefail
APK="${1:-C:/Users/Hey/WorkBuddy/2026-10-01-18-25-35/apk-new/app-release.apk}"
[ -f "$APK" ] || { echo "找不到 APK: $APK"; exit 1; }

echo "APK: $APK"
echo "大小: $(du -h "$APK" | cut -f1)"
echo

python - "$APK" <<'PY'
import re, sys, zipfile

apk = sys.argv[1]
z = zipfile.ZipFile(apk)
with z.open('assets/index.android.bundle') as f:
    bundle = f.read().decode('utf-8', errors='replace')

print('bundle 字符数:', len(bundle))
print()
real = bundle.count('dodokid.heymf.cn')
placeholder = len(re.findall(r'dodokid\.example\.com', bundle))

print('=== 关键计数 ===')
print('  dodokid.heymf.cn出现次数 :', real)
print('  dodokid.example.com 次数 :', placeholder)
print()

print('=== 真实地址上下文 ===')
for i, m in enumerate(re.finditer(r'dodokid\.heymf\.cn', bundle)):
    if i >= 3:
        break
    s = max(0, m.start() - 60)
    print('  >>>', bundle[s:m.end() + 40].replace('\n', ' '))
print()

print('=== 全部 https 主机名 ===')
for h in sorted(set(re.findall(r'https?://([a-zA-Z0-9._-]+)', bundle))):
    print('  ', h)
print()

# 判定必须区分两件不同的事：
#   1) 后端 API 地址 —— 由 app.json extra.apiBaseUrl / EXPO_PUBLIC_API_BASE_URL 决定，
#      打包时内联进bundle。
#   2) 媒体资源地址 —— 数据文件只存相对 key（english/e-cake.mp3），运行时由后端
#      /version 下发的 mediaBaseUrl 拼接（见 src/shared/lib/mediaBase.ts）。
#      正常包内不应再出现 example.com 占位符；若出现说明构建的是旧代码。
# 所以 API 地址正确即PASS；媒体占位符单列为 WARN，不判 FAIL。
api_ok = real > 0 and '/api/v1' in bundle

print('=== 判定 ===')
if api_ok:
    print('  [PASS] 后端 API 地址已内联为真实域名: https://dodokid.heymf.cn/api/v1')
else:
    print('  [FAIL] 后端 API 地址未正确内联')

if placeholder > 0:
    groups = sorted({m.group(1) for m in re.finditer(
        r'https://cdn\.dodokid\.example\.com/([a-z]+)/', bundle)})
    print(f'  [WARN] 残留 {placeholder} 处 example.com 媒体占位地址')
    print('         分布模块:', ', '.join(groups))
    print('         影响: 绘本封面/音频 404，不影响 API 连通')
    print('         含义: 构建的是改造前的旧代码（媒体未运行时化），需重新构建')
else:
    print('  [OK] 无媒体占位地址残留')

sys.exit(0 if api_ok else 1)
PY