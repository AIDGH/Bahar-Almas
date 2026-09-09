import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import {
  environmentFilePaths,
  environmentValidationSchema,
} from './config/environment';
import { GameModule } from './game/game.module';
import { HealthController } from './health.controller';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: environmentFilePaths,
      validationSchema: environmentValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    AdminModule,
    AuthModule,
    GameModule,
    LeaderboardModule,
    ProfileModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
