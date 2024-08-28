const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Ваш GitHub username
const username = 'anxist'; // Замените на ваш реальный GitHub username

// URL для получения всех репозиториев пользователя
const reposUrl = `https://api.github.com/users/${username}/repos?per_page=100`;

// Путь к кэшированному файлу
const cacheFile = path.join(__dirname, 'cache.json');

// Функция для создания прогресс-бара с фиксированной шириной
const createProgressBar = (percentage, barLength = 20) => {
    percentage = Math.max(0, Math.min(100, percentage));
    const filledLength = Math.round(barLength * percentage / 100);
    if (filledLength < 0 || filledLength > barLength) {
        console.error(`Invalid filledLength value: ${filledLength}`);
        return 'Error';
    }
    const bar = '🟩'.repeat(filledLength) + '🟨'.repeat(0) + '⬜'.repeat(barLength - filledLength);
    return bar;
};

// Функция для генерации таблицы
const generateTable = (languages) => {
    const totalBytes = Object.values(languages).reduce((acc, bytes) => acc + bytes, 0);
    if (totalBytes === 0) {
        throw new Error('Total bytes of code is zero. Cannot generate table.');
    }
    const sortedLanguages = Object.entries(languages)
        .sort(([, bytesA], [, bytesB]) => bytesB - bytesA);
    const maxLanguageLength = Math.max(...sortedLanguages.map(([language]) => language.length), 10);
    const maxUsageLength = 40; // Длина прогресс-бара
    const maxPercentageLength = 8; // Длина процентного значения
    const tableHeader = `| 🌐 Language${' '.repeat(maxLanguageLength - 13)} | 📊 Usage${' '.repeat(maxUsageLength - 8)} | 📈 Percentage |\n` +
        `|${'-'.repeat(maxLanguageLength + 2)}|${'-'.repeat(maxUsageLength + 2)}|${'-'.repeat(maxPercentageLength + 2)}|\n`;
    const tableRows = sortedLanguages.map(([language, bytesOfCode]) => {
        const percentage = (bytesOfCode / totalBytes * 100).toFixed(2);
        return `| ${language.padEnd(maxLanguageLength)} | ${createProgressBar(percentage).padEnd(maxUsageLength)} | ${percentage.padStart(maxPercentageLength)}% |`;
    }).join('\n');
    return tableHeader + tableRows;
};

// Функция для получения репозиториев из кэша или из GitHub API
const getRepos = async () => {
    if (fs.existsSync(cacheFile)) {
        // Читаем данные из кэша
        const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        return cachedData.repos || [];
    } else {
        // Получаем данные из API
        try {
            const response = await axios.get(reposUrl, {
                headers: {
                    'User-Agent': 'axios'
                }
            });
            const repos = response.data;
            fs.writeFileSync(cacheFile, JSON.stringify({ repos }), 'utf8');
            return repos;
        } catch (error) {
            console.error('Error fetching repositories:', error.message);
            return [];
        }
    }
};

// Функция для получения языков репозиториев
const fetchLanguages = async () => {
    try {
        const repos = await getRepos();
        console.log(`Fetched ${repos.length} repositories.`);

        const languageCount = {};
        const maxRepos = 30; // Ограничение на количество репозиториев для запроса

        for (let i = 0; i < Math.min(repos.length, maxRepos); i++) {
            const repo = repos[i];
            const languagesUrl = repo.languages_url;

            try {
                const languagesResponse = await axios.get(languagesUrl, {
                    headers: {
                        'User-Agent': 'axios'
                    }
                });
                const languages = languagesResponse.data;
                console.log(`Fetched languages for repo ${repo.name}`);

                for (const [language, bytesOfCode] of Object.entries(languages)) {
                    if (languageCount[language]) {
                        languageCount[language] += bytesOfCode;
                    } else {
                        languageCount[language] = bytesOfCode;
                    }
                }
            } catch (error) {
                console.error(`Error fetching languages for repo ${repo.name}:`, error.message);
            }

            // Добавляем задержку между запросами
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const table = generateTable(languageCount);
        console.log(table);

        // Записываем таблицу в README.md
        fs.appendFileSync('README.md', `\n## 🌟 Most Used Languages\n\n${table}\n`, 'utf8');
        console.log('Table successfully added to README.md');
    } catch (error) {
        console.error('Error fetching data:', error.message);
    }
};

fetchLanguages();