# AI Pace

> Keep your AI credit usage in sync with your workday progress.

**AI Pace（AI 配速）** 是一个帮助 AI 用量敏感型用户管理 **AI Credits** 的应用。

它会自动计算当前月份 **工作日进度**，并与你设置的 **AI Credits
使用进度** 进行实时对比，让你始终知道自己的 AI 使用节奏是否合理。

------------------------------------------------------------------------

## ✨ Features

-   📅 自动获取每个月份的工作日（智能节假日/调休）
-   📈 显示工作日进度百分比
-   🤖 手动记录 AI Credits 总额度与已使用额度（后续可能增加自动获取功能）
-   ⚖️ 直观对比工作进度与 AI 使用进度
-   🗓️ 内置工作日日历，可手动设置请假/加班（但**不会支持**自动按照大小周、单休、996进行设置，**这种病态的工时模式不应当被推广**）
-   🎨 简洁优美的界面

------------------------------------------------------------------------

## 💡 Why AI Pace?

许多 AI 服务（Claude、GitHub Copilot 等）都采用按月额度的计费方式。

**AI Pace 旨在帮助你更直观、精准地了解本月的工作日已经过完了多少**

例如：对于2026年7月12日，**看似**7月已经度过了将近**半个月**，但**实际上**工作日只度过了8/23，才刚过**三分之一**！

这样，你**无需对着日历心算**，只需要打开 App 看一眼即可。

------------------------------------------------------------------------

## 📱 Screenshot

##### 主页面：

<img src="assets/screenshots/main.jpg" alt="main" style="zoom: 33%;" />



##### 【仅限1.2版本的Beta功能】自动获取GitHub Copilot的AI Credits用量。

- 此功能我没有测试过，因为我没有个人订阅的账号。不过它是一个仅查询的接口，就算有bug也是无害的。

* 该功能只支持个人版订阅，因为Organization/Enterprise版用到的API不一样，并且需要你有Organization/Enterprise的管理员权限

<img src="assets\screenshots\CreditsEdit.jpg" alt="CreditsEdit" style="zoom:33%;" />



* 【1.3及以后的版本】我的解决方案是：

  - 在使用Copilot的电脑上写一个爬虫，把数据通过腾讯云的云函数上传到云数据库（MongoDB）
  - App通过云函数从云服务器拉取数据
  - 使用云函数几乎（甚至完全）没有成本

  <img src="assets\screenshots\SCF.jpg" alt="SCF" style="zoom:33%;" />

  - **cloud-function**目录下的代码就是你需要上传到云函数的代码包，test-data.json不仅是测试数据，也揭示了数据结构。.trae/documents目录下也有AI写的开发计划。希望这些资料足够你完成云函数的部署。如果不懂的话问问你的AI，直接把腾讯云的CloudBase MCP给AI，它应该能替你搞定！

##### AI Credits颜色会随着用量与工作日进度的百分比关系而改变。

当AI Credits与工作日进度相当时，显示橙色：

<img src="assets\screenshots\color1.jpg" alt="橙色" style="zoom:33%;" />

超出进度时，红色：

<img src="assets\screenshots\color2.jpg" alt="红色" style="zoom:33%;" />

Tip：在AI Credits卡片上左右滑动可以快速修改已用量。

------------------------------------------------------------------------

## 🚀 Tech Stack

-   React Native
-   Expo
-   TypeScript
-   React Navigation

------------------------------------------------------------------------

## 📦 Installation

自行通过Android Studio构建：

``` bash
npm install

npx expo start
```

或从release下载apk安装

------------------------------------------------------------------------

## 🤝 Contributing

欢迎提交 Issue 和 Pull Request。

如果这个项目对你有帮助，欢迎点一个 ⭐。

------------------------------------------------------------------------

## License

MIT License
