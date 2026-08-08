package controller

import (
	"net/http"
	"strconv"

	"your-junior/internal/logger"
	"your-junior/internal/model"
	"your-junior/internal/service"

	"github.com/gin-gonic/gin"
)

func SetupGitRoutes(router gin.IRouter, projectSvc *service.ProjectService, worktreeSvc *service.WorktreeService) {
	handler := &gitHandler{
		projectSvc:  projectSvc,
		worktreeSvc: worktreeSvc,
	}

	g := router.Group("/api")
	g.GET("/projects", handler.listProjects)
	g.POST("/projects", handler.addProject)
	g.DELETE("/projects/:id", handler.removeProject)
	g.POST("/projects/:id/branches", handler.fetchBranches)
	g.GET("/projects/:id/branches", handler.listBranches)
	g.GET("/projects/:id/worktrees", handler.listWorktrees)
	g.POST("/projects/:id/worktrees", handler.createWorktree)
	g.DELETE("/worktrees/:id", handler.removeWorktree)
}

type gitHandler struct {
	projectSvc  *service.ProjectService
	worktreeSvc *service.WorktreeService
}

type addProjectRequest struct {
	GitURL string `json:"git_url"`
	Name   string `json:"name,omitempty"`
}

type createWorktreeRequest struct {
	Branch string `json:"branch"`
}

func (h *gitHandler) listProjects(c *gin.Context) {
	projects, err := h.projectSvc.ListProjects()
	if err != nil {
		logger.L.Error("failed to list projects", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to list projects: " + err.Error(),
		})
		return
	}

	if projects == nil {
		projects = make([]*model.Project, 0)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   projects,
	})
}

func (h *gitHandler) addProject(c *gin.Context) {
	var req addProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "invalid request body: " + err.Error(),
		})
		return
	}

	if req.GitURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "git_url is required",
		})
		return
	}

	project, err := h.projectSvc.AddProject(req.GitURL)
	if err != nil {
		logger.L.Error("failed to add project", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to add project: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   project,
	})
}

func (h *gitHandler) removeProject(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "invalid project id",
		})
		return
	}

	if err := h.projectSvc.RemoveProject(id); err != nil {
		logger.L.Error("failed to remove project", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to remove project: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "project removed",
	})
}

func (h *gitHandler) fetchBranches(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "invalid project id",
		})
		return
	}

	branches, err := h.projectSvc.FetchBranches(id)
	if err != nil {
		logger.L.Error("failed to fetch branches", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to fetch branches: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   branches,
	})
}

func (h *gitHandler) listBranches(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "invalid project id",
		})
		return
	}

	branches, err := h.projectSvc.FetchBranches(id)
	if err != nil {
		logger.L.Error("failed to list branches", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to list branches: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   branches,
	})
}

func (h *gitHandler) listWorktrees(c *gin.Context) {
	projectIDStr := c.Param("id")
	var projectID int64
	if projectIDStr != "" {
		var err error
		projectID, err = strconv.ParseInt(projectIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "invalid project id",
			})
			return
		}
	}

	worktrees, err := h.worktreeSvc.ListWorktrees(projectID)
	if err != nil {
		logger.L.Error("failed to list worktrees", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to list worktrees: " + err.Error(),
		})
		return
	}

	if worktrees == nil {
		worktrees = make([]*model.Worktree, 0)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   worktrees,
	})
}

func (h *gitHandler) createWorktree(c *gin.Context) {
	projectID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "invalid project id",
		})
		return
	}

	var req createWorktreeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "invalid request body: " + err.Error(),
		})
		return
	}

	if req.Branch == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "branch is required",
		})
		return
	}

	worktree, err := h.worktreeSvc.CreateWorktree(projectID, req.Branch)
	if err != nil {
		logger.L.Error("failed to create worktree", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to create worktree: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   worktree,
	})
}

func (h *gitHandler) removeWorktree(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "invalid worktree id",
		})
		return
	}

	if err := h.worktreeSvc.RemoveWorktree(id); err != nil {
		logger.L.Error("failed to remove worktree", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to remove worktree: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "worktree removed",
	})
}
