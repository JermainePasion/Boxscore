import express from "express"
import {
  getMyPyramid,
  getPyramidByUser,
  savePyramid,
  deletePyramid
} from "../controllers/pyramidController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.get("/me", authenticate, getMyPyramid)
router.get("/:userId", getPyramidByUser)
router.put("/", authenticate, savePyramid)
router.delete("/", authenticate, deletePyramid)

export default router