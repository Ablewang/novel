import { Controller, Get, Post, Inject, Param, Body, Query } from '@midwayjs/core';
import { StorageService } from '../service/storage.service.js';
import { ChatService } from '../service/chat.service.js';

@Controller('/api')
export class ProjectController {
  @Inject()
  storageService!: StorageService;

  @Inject()
  chatService!: ChatService;

  @Post('/project')
  async create(@Body() body: { title: string; genre?: string; logline?: string }) {
    const { title, genre = '', logline = '' } = body;
    if (!title) {
      return { success: false, error: 'title is required' };
    }
    const project = this.storageService.createProject(title, genre, logline);
    return { success: true, project };
  }

  @Get('/projects')
  async list() {
    const projects = this.storageService.listProjects();
    return { projects };
  }

  @Get('/project/:id')
  async get(@Param('id') id: string) {
    const snapshot = this.storageService.getProjectSnapshot(id);
    if (!snapshot) {
      return { error: 'Project not found' };
    }
    return snapshot;
  }

  @Get('/project/:id/chapter/:chapterId')
  async getChapter(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
  ) {
    const content = this.storageService.getChapterContent(id, chapterId);
    if (content === null) {
      return { error: 'Chapter not found' };
    }
    return { chapterId, content };
  }

  @Get('/project/:id/threads')
  async listThreads(@Param('id') id: string) {
    const threads = this.chatService.listThreads(id);
    return { threads };
  }

  @Get('/thread/:threadId/messages')
  async getMessages(
    @Param('threadId') threadId: string,
    @Query('projectId') projectId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    if (!projectId) {
      return { error: 'projectId is required' };
    }
    const messages = this.chatService.getMessages(
      projectId,
      threadId,
      offset ? parseInt(offset, 10) : 0,
      limit ? parseInt(limit, 10) : 50,
    );
    return { messages };
  }
}
