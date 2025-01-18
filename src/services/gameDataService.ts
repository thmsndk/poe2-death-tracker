import * as path from "path";
import * as fs from "fs/promises";

export interface MonsterVariety {
  _index: number;
  Id: string;
  Name: string;
  BossHealthBar: boolean;
}

export interface Match<T> {
  item: T;
  matchedBy: string;
}

export class GameDataService {
  public monsterVarieties: MonsterVariety[] = [];
  private language: string = "English"; // Default to English

  async loadData(dataPath: string) {
    try {
      const tablesPath = path.join(dataPath, "data", "tables", this.language);

      const monsterVarietiesData = await fs.readFile(
        path.join(tablesPath, "MonsterVarieties.json"),
        "utf-8"
      );

      this.monsterVarieties = JSON.parse(monsterVarietiesData);
    } catch (error) {
      console.error(
        `Failed to load game data for language ${this.language}:`,
        error
      );
      throw error;
    }
  }

  findMatchingMonsterVarieties(
    partialName: string | string[]
  ): Match<MonsterVariety>[] {
    const searches = Array.isArray(partialName) ? partialName : [partialName];
    const lowerSearches = searches.map((s) => s.toLowerCase());

    const matches: Match<MonsterVariety>[] = [];

    this.monsterVarieties.forEach((item) => {
      const itemNameLower = item.Name.toLowerCase();
      const matchingSearch = lowerSearches.find((search) =>
        itemNameLower.includes(search)
      );

      if (matchingSearch) {
        matches.push({
          item,
          matchedBy: searches[lowerSearches.indexOf(matchingSearch)],
        });
      }
    });

    return matches;
  }

  findExactMonsterVariety(name: string | string[]): Match<MonsterVariety>[] {
    const names = Array.isArray(name) ? name : [name];
    const matches: Match<MonsterVariety>[] = [];

    this.monsterVarieties.forEach((item) => {
      const itemNameLower = item.Name.toLowerCase();
      const matchingName = names.find((n) => itemNameLower === n.toLowerCase());
      if (matchingName) {
        matches.push({
          item,
          matchedBy: matchingName,
        });
      }
    });

    return matches;
  }
}
