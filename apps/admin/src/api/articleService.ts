import apiClient from "@/services/apiClient";

const articleService = {
  getArticle(params: any) {
    return apiClient.get("/admin/article", { params });
  },
  getArticleDetail(id: number) {
    return apiClient.get(`/admin/article/${id}`);
  },
};

export default articleService;
