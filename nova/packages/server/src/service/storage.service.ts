/**
 * JSON 文件存储服务 (Midway Service)
 */
import { Provide } from '@midwayjs/core';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type {
  NovelProject,
  WorldSetting,
  Character,
  OutlineTree,
  ProjectSnapshot,
} from '@nova/shared';

@Provide()
export class StorageService {
  /** 数据目录：从 packages/server 往上看两层为项目根，再 data/projects */
  private get dataDir(): string {
    return path.resolve(process.cwd(), '..', '..', 'data', 'projects');
  }

  private projectDir(projectId: string): string {
    return path.join(this.dataDir, projectId);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private readJson<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  }

  private writeJson(filePath: string, data: unknown): void {
    this.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  createProject(title: string, genre: string, logline: string): NovelProject {
    const project: NovelProject = {
      id: uuidv4(),
      metadata: {
        title,
        genre,
        tags: [],
        targetAudience: '',
        logline,
      },
      currentProgress: { volumeIndex: 0, chapterIndex: 0, sceneIndex: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.writeJson(path.join(this.projectDir(project.id), 'project.json'), project);
    return project;
  }

  getProject(projectId: string): NovelProject | null {
    return this.readJson<NovelProject>(path.join(this.projectDir(projectId), 'project.json'));
  }

  updateProject(project: NovelProject): void {
    project.updatedAt = new Date().toISOString();
    this.writeJson(path.join(this.projectDir(project.id), 'project.json'), project);
  }

  listProjects(): NovelProject[] {
    this.ensureDir(this.dataDir);
    const dirs = fs.readdirSync(this.dataDir, { withFileTypes: true });
    const projects: NovelProject[] = [];
    for (const d of dirs) {
      if (d.isDirectory()) {
        const p = this.getProject(d.name);
        if (p) projects.push(p);
      }
    }
    return projects;
  }

  getWorldSetting(projectId: string): WorldSetting | null {
    return this.readJson<WorldSetting>(path.join(this.projectDir(projectId), 'world.json'));
  }

  saveWorldSetting(projectId: string, world: WorldSetting): void {
    this.writeJson(path.join(this.projectDir(projectId), 'world.json'), world);
  }

  getCharacters(projectId: string): Character[] {
    return this.readJson<Character[]>(path.join(this.projectDir(projectId), 'characters.json')) || [];
  }

  saveCharacters(projectId: string, characters: Character[]): void {
    this.writeJson(path.join(this.projectDir(projectId), 'characters.json'), characters);
  }

  getOutline(projectId: string): OutlineTree | null {
    return this.readJson<OutlineTree>(path.join(this.projectDir(projectId), 'outline.json'));
  }

  saveOutline(projectId: string, outline: OutlineTree): void {
    this.writeJson(path.join(this.projectDir(projectId), 'outline.json'), outline);
  }

  getChapterContent(projectId: string, chapterId: string): string | null {
    const filePath = path.join(this.projectDir(projectId), 'chapters', `${chapterId}.md`);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  }

  saveChapterContent(projectId: string, chapterId: string, content: string): void {
    const dir = path.join(this.projectDir(projectId), 'chapters');
    this.ensureDir(dir);
    fs.writeFileSync(path.join(dir, `${chapterId}.md`), content, 'utf-8');
  }

  getProjectSnapshot(projectId: string): ProjectSnapshot | null {
    const project = this.getProject(projectId);
    if (!project) return null;
    return {
      project,
      world: this.getWorldSetting(projectId),
      characters: this.getCharacters(projectId),
      outline: this.getOutline(projectId),
    };
  }
}
