import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { ArticleService } from '../../../core/services/articles';
import { Article } from '../../../core/models/article.model';

@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [MatTableModule, MatCardModule],
  templateUrl: './article-list.html',
  styleUrl: './article-list.scss'
})
export class ArticleListComponent implements OnInit {
  private articleService = inject(ArticleService);
  private cdr = inject(ChangeDetectorRef);

  displayedColumns: string[] = ['code', 'name', 'model', 'stock', 'measurementUnit'];
  dataSource: Article[] = [];

  ngOnInit() {
    this.articleService.getArticles().subscribe({
      next: (data: Article[]) => {
        this.dataSource = data;
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Error cargando artículos', err)
    });
  }
}