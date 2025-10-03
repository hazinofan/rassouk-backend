import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from 'src/users/users.entity'; 

@Entity('saved_candidates')
@Unique(['employer', 'candidate'])
export class SavedCandidate {
  @PrimaryGeneratedColumn()
  id: number;

  // Employer who saved the candidate
  @ManyToOne(() => User, (user) => user.savedCandidates, { onDelete: 'CASCADE' })
  employer: User;

  // Candidate who was saved
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  candidate: User;

  @CreateDateColumn()
  createdAt: Date;
}
