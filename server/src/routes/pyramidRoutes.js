import express from "express"
import {
  getMyPyramids,
  getPyramidsByUser,
  getPyramidById,
  createPyramid,
  savePyramid,
  deletePyramid,
} from "../controllers/pyramidController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.get("/me", authenticate, getMyPyramids)
router.get("/user/:userId", getPyramidsByUser)
router.post("/", authenticate, createPyramid)
router.put("/:id", authenticate, savePyramid)
router.delete("/:id", authenticate, deletePyramid)
router.get("/:id", getPyramidById) 

export default router