// src/routes/index.ts
import { Router } from "express";
import authRoutes from "./authRoutes.ts";
import articleRoutes from "./articleRoutes.ts";
import categoryRoutes from "./categoryRoutes.ts";
import noteRoutes from "./noteRoutes.ts";
import timelineRoutes from "./timelineRoutes.ts";
import uploadRoutes from "./uploadRoutes.ts";
// import userRoutes from "./userRoutes.ts";
// import roleRoutes from "./roleRoutes";
// import permissionRoutes from "./permissionRoutes";
// import statsRoutes from "./statsRoutes";

const router = Router();

router.use("/auth/", authRoutes);
router.use("/admin/article", articleRoutes);
router.use("/admin/category", categoryRoutes);
router.use("/admin/note", noteRoutes);
router.use("/admin/timeline", timelineRoutes);
router.use("/admin/upload", uploadRoutes);
// router.use("/", userRoutes);
// router.use("/", roleRoutes);
// router.use("/", permissionRoutes);
// router.use("/", statsRoutes);

export default router;
