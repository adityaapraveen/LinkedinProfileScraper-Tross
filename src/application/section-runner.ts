import { DomainError } from '../domain/errors.js';
import type { CanonicalProfile, ProfileSection } from '../domain/profile.js';
import type { ProfileContext } from '../linkedin/endpoints/endpoint-manifest.js';

export type SectionResult = {
  [Section in ProfileSection]: {
    section: Section;
    data: CanonicalProfile[Section];
    source: string;
  };
}[ProfileSection];

export type SectionOperation = (context: ProfileContext) => Promise<SectionResult>;

export interface SectionTask {
  section: ProfileSection;
  run: SectionOperation;
}

export interface SettledSection {
  section: ProfileSection;
  durationMs: number;
  result: PromiseSettledResult<SectionResult>;
}

export class SectionRunner {
  constructor(
    private readonly concurrency: number,
    private readonly deadlineMs: number,
  ) {}

  async run(tasks: readonly SectionTask[], context: ProfileContext): Promise<SettledSection[]> {
    const startedAt = Date.now();
    const output = new Array<SettledSection>(tasks.length);
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < tasks.length) {
        const index = nextIndex;
        nextIndex += 1;
        const task = tasks[index];
        if (!task) continue;
        const sectionStartedAt = Date.now();
        const remaining = this.deadlineMs - (sectionStartedAt - startedAt);
        if (remaining <= 0) {
          output[index] = {
            section: task.section,
            durationMs: 0,
            result: {
              status: 'rejected',
              reason: new DomainError('UPSTREAM_TIMEOUT', 'The extraction deadline was exceeded'),
            },
          };
          continue;
        }

        output[index] = {
          section: task.section,
          durationMs: 0,
          result: await this.settleWithDeadline(task.run(context), remaining),
        };
        output[index].durationMs = Date.now() - sectionStartedAt;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, tasks.length) }, () => worker()),
    );
    return output;
  }

  private async settleWithDeadline(
    operation: Promise<SectionResult>,
    timeoutMs: number,
  ): Promise<PromiseSettledResult<SectionResult>> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<SectionResult>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new DomainError('UPSTREAM_TIMEOUT', 'The extraction deadline was exceeded')),
        timeoutMs,
      );
      timer.unref();
    });
    try {
      const value = await Promise.race([operation, timeout]);
      return { status: 'fulfilled', value };
    } catch (reason) {
      return { status: 'rejected', reason };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
