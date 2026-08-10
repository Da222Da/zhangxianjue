import apiClient from "@/services/apiClient";

const articleService = {
  getArticle(params: any) {
    return apiClient.get("/admin/article", { params });
  },
  getArticleDetail(id: number) {
    return apiClient.get(`/admin/article/${id}`);
  },
  updateArticle(id: number, data: any) {
    return apiClient.put(`/admin/article/${id}`, data);
  },
};

export default articleService;
