// // src/store/auth.ts
// import { defineStore } from "pinia";
// import authService from "@/api/authService";
// import { User } from "@/types/api";
// import router from "@/router";
// import { ElNotification } from "element-plus";

// interface AuthState {
//   user: User | null;
//   accessToken: string | null;
//   refreshToken: any;
// }

// export const useAuthStore = defineStore("auth", {
//   state: (): AuthState => ({
//     user: null,
//     accessToken: localStorage.getItem("accessToken"),
//     refreshToken: localStorage.getItem("refreshToken"),
//   }),
//   getters: {
//     isAuthenticated: (state) => !!state.accessToken && !!state.user,
//   },
//   persist: true, // 状态持久化
//   actions: {
//     async login(params: { username: string; password: string }) {
//       try {
//         const { data } = await authService.login(params);
//         this.accessToken = data.token;
//         this.refreshToken = data.refreshToken;

//         localStorage.setItem("accessToken", this.accessToken);
//         localStorage.setItem("refreshToken", this.refreshToken);

//         await this.fetchUser();
//         ElNotification({
//           title: "提示",
//           message: "欢迎进入系统！",
//           type: "success",
//         });
//         router.push({ name: "Dashboard" });
//       } catch (error) {
//         ElNotification({
//           title: "登录失败",
//           message: "请检查用户名和密码。",
//           type: "error",
//         });
//         throw error;
//       }
//     },
//     async register(params: { username: string; email: string; password: string }) {
//       try {
//         await authService.register(params);
//         ElNotification({
//           title: "成功",
//           message: "注册成功！请登录。",
//           type: "success",
//         });
//       } catch (error) {
//         throw error;
//       }
//     },
//     async fetchUser() {
//       try {
//         const { data } = await authService.getUser();
//         this.user = data || {};
//       } catch (error) {
//         console.error("获取用户信息失败", error);
//       }
//     },
//     logout() {
//       this.user = null;
//       this.accessToken = null;
//       this.refreshToken = null;

//       localStorage.removeItem("accessToken");
//       localStorage.removeItem("refreshToken");

//       router.push({ name: "Login" });
//     },
//     async refreshToken() {
//       try {
//         const { data } = await authService.refreshToken(this.accessToken || "");
//         this.accessToken = data.token;
//         this.refreshToken = data.refreshToken;

//         localStorage.setItem("accessToken", this.accessToken);
//         localStorage.setItem("refreshToken", this.refreshToken);

//         await this.fetchUser();
//       } catch (error) {
//         throw error;
//       }
//     },
//   },
// });
