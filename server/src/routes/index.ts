// src/routes/index.ts
import { Router } from "express";
import adminMembershipRoutes from "./adminMembershipRoutes.ts";
import articleRoutes from "./articleRoutes.ts";
import authRoutes from "./authRoutes.ts";
import bookRoutes from "./bookRoutes.ts";
import categoryRoutes from "./categoryRoutes.ts";
import libraryRoutes from "./libraryRoutes.ts";
import membershipRoutes from "./membershipRoutes.ts";
import noteRoutes from "./noteRoutes.ts";
import permissionRoutes from "./permissionRoutes.ts";
import roleRoutes from "./roleRoutes.ts";
import timelineRoutes from "./timelineRoutes.ts";
import uploadRoutes from "./uploadRoutes.ts";
import userRoutes from "./userRoutes.ts";

const router = Router();

router.use("/auth/", authRoutes);
router.use("/admin/article", articleRoutes);
router.use("/admin/book", bookRoutes);
router.use("/admin/category", categoryRoutes);
router.use("/admin/membership", adminMembershipRoutes);
router.use("/admin/note", noteRoutes);
router.use("/admin/permission", permissionRoutes);
router.use("/admin/role", roleRoutes);
router.use("/admin/timeline", timelineRoutes);
router.use("/admin/upload", uploadRoutes);
router.use("/admin/user", userRoutes);
router.use("/library", libraryRoutes);
router.use("/membership", membershipRoutes);

export default router;
