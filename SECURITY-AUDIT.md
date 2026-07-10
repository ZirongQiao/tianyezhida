# 公开仓库安全审计与脱敏说明

本文档记录「田野直达」微信小程序公开仓库的安全审计结论及已执行的脱敏项。

## 已脱敏项

| 位置 | 原内容 | 脱敏后 |
|------|--------|--------|
| `project.config.json` → `appid` | 真实小程序 AppID | `wxYOUR_APPID_HERE` |
| `miniprogram/app.js` → `env` | 真实云开发环境 ID | `cloud1-your-env-id` |

克隆仓库后，请将上述占位符替换为你自己的 AppID 与云开发环境 ID。

## 刻意保留的公开信息

以下信息经确认可公开，未做脱敏：

- **客服电话**：`17358512219`（`miniprogram/pages/map/map.js`）
- **客服微信二维码**：`miniprogram/images/qrcode.png`
- **Mock 示例农户**：`miniprogram/data/merchants.js`（含「田家小妹家」等演示数据）

## 生产环境安全建议

### `approveClaimRequest` 需增加管理员鉴权

云函数 `cloudfunctions/quickstartFunctions/index.js` 中的 `approveClaimRequest` 接口当前**未做管理员身份校验**。在公开仓库中保留该业务逻辑供参考，但**生产环境部署前必须增加管理员鉴权**（例如校验操作者 openid 是否在管理员白名单内，或通过云开发控制台权限限制调用方），否则任意用户可能审批认领申请。

### 其他建议

- 将 `TENCENT_MAP_KEY` 等密钥配置在云函数环境变量中，勿写入代码仓库。
- 确保 `project.private.config.json` 不被提交（已加入 `.gitignore`）。
