import { Module } from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';

@Module({
  providers: [LinkPreviewService],
  exports: [LinkPreviewService],
})
export class LinkPreviewModule {}
