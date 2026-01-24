"""
Task manager for tracking async API callbacks.

This module provides a simple in-memory task tracking system for associating
callback responses with pending async operations.
"""

import asyncio
from typing import Dict, Optional, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class TaskResult:
    """
    Container for task results with async waiting support.
    """
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.event = asyncio.Event()
        self.result: Optional[Any] = None
        self.error: Optional[Exception] = None
        self.created_at = datetime.now()
        self.completed = False
    
    async def wait(self, timeout: Optional[float] = None) -> Any:
        """
        Wait for the task to complete.
        
        Args:
            timeout: Maximum time to wait in seconds (None = no timeout)
        
        Returns:
            The task result
        
        Raises:
            TimeoutError: If timeout is exceeded
            Exception: If the task failed
        """
        try:
            await asyncio.wait_for(self.event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Task {self.task_id} timed out after {timeout} seconds")
        
        if self.error:
            raise self.error
        
        return self.result
    
    def set_result(self, result: Any):
        """Set the task result and notify waiters."""
        self.result = result
        self.completed = True
        self.event.set()
    
    def set_error(self, error: Exception):
        """Set the task error and notify waiters."""
        self.error = error
        self.completed = True
        self.event.set()


class TaskManager:
    """
    In-memory task manager for tracking async API callbacks.
    
    This is a simple implementation suitable for single-server deployments.
    For production with multiple servers, consider using Redis or a database.
    """
    
    def __init__(self, cleanup_interval: int = 3600):
        """
        Initialize the task manager.
        
        Args:
            cleanup_interval: Seconds between cleanup runs (default: 1 hour)
        """
        self._tasks: Dict[str, TaskResult] = {}
        self._cleanup_interval = cleanup_interval
        self._cleanup_task: Optional[asyncio.Task] = None
    
    def create_task(self, task_id: str) -> TaskResult:
        """
        Create a new task tracker.
        
        Args:
            task_id: Unique task identifier
        
        Returns:
            TaskResult: Task result object for waiting on completion
        
        Raises:
            ValueError: If task_id already exists
        """
        if task_id in self._tasks:
            raise ValueError(f"Task {task_id} already exists")
        
        task_result = TaskResult(task_id)
        self._tasks[task_id] = task_result
        logger.debug(f"Created task tracker: {task_id}")
        
        # Start cleanup task if not already running
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        return task_result
    
    def get_task(self, task_id: str) -> Optional[TaskResult]:
        """
        Get a task tracker by ID.
        
        Args:
            task_id: Task identifier
        
        Returns:
            TaskResult if found, None otherwise
        """
        return self._tasks.get(task_id)
    
    def complete_task(self, task_id: str, result: Any):
        """
        Mark a task as completed with a result.
        
        Args:
            task_id: Task identifier
            result: Task result value
        """
        task = self._tasks.get(task_id)
        if task:
            task.set_result(result)
            logger.debug(f"Task {task_id} completed successfully")
        else:
            logger.warning(f"Attempted to complete unknown task: {task_id}")
    
    def fail_task(self, task_id: str, error: Exception):
        """
        Mark a task as failed.
        
        Args:
            task_id: Task identifier
            error: Error that occurred
        """
        task = self._tasks.get(task_id)
        if task:
            task.set_error(error)
            logger.debug(f"Task {task_id} failed: {error}")
        else:
            logger.warning(f"Attempted to fail unknown task: {task_id}")
    
    def remove_task(self, task_id: str):
        """
        Remove a completed task from tracking.
        
        Args:
            task_id: Task identifier
        """
        if task_id in self._tasks:
            del self._tasks[task_id]
            logger.debug(f"Removed task tracker: {task_id}")
    
    async def _cleanup_loop(self):
        """
        Background task to clean up old completed tasks.
        """
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                await self._cleanup()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
    
    async def _cleanup(self, max_age_hours: int = 24):
        """
        Remove tasks older than max_age_hours.
        
        Args:
            max_age_hours: Maximum age in hours before cleanup
        """
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        to_remove = [
            task_id for task_id, task in self._tasks.items()
            if task.created_at < cutoff and task.completed
        ]
        
        for task_id in to_remove:
            self.remove_task(task_id)
        
        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} old tasks")


# Global task manager instance
_task_manager = TaskManager()


def get_task_manager() -> TaskManager:
    """Get the global task manager instance."""
    return _task_manager

