document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    // UI Elements
    const loading = document.getElementById('loading');
    const errorBox = document.getElementById('errorBox');
    const allDataBox = document.getElementById('allDataBox');
    const resultCard = document.getElementById('resultCard');
    const tableBody = document.getElementById('tableBody');
    const backBtn = document.getElementById('backBtn');
    const errorBackBtn = document.getElementById('errorBackBtn');
    const monthSelect = document.getElementById('monthSelect');
    
    // Data Elements
    const resCode = document.getElementById('res-code');
    const resName = document.getElementById('res-name');
    const resPrice = document.getElementById('res-price');
    const resDividend = document.getElementById('res-dividend');
    const resYield = document.getElementById('res-yield');
    const resDate = document.getElementById('res-date');
    const resAnalysis = document.getElementById('res-analysis');

    let etfDataMap = new Map();
    let etfList = [];
    
    let currentSortCol = null;
    let currentSortDesc = true;

    init();

    async function init() {
        showState(loading);
        try {
            const response = await fetch('./StockList.csv');
            if(!response.ok) {
                throw new Error('Network response was not ok');
            }
            const csvText = await response.text();
            parseCSVData(csvText);
            renderTable();
            showState(allDataBox);
        } catch(error) {
            console.error("Error loading CSV:", error);
            errorBox.innerHTML = '<p>資料庫載入失敗，請稍後再試。</p>';
            showState(errorBox);
        }
    }

    function showState(elementToShow) {
        // Hide major sections
        loading.classList.add('hidden');
        errorBox.classList.add('hidden');
        allDataBox.classList.add('hidden');
        resultCard.classList.add('hidden');
        
        if(elementToShow) {
            elementToShow.classList.remove('hidden');
        }
    }

    function parseSimpleCSV(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for(let i=0; i<line.length; i++) {
            let char = line[i];
            if(char === '"') {
                 inQuotes = !inQuotes;
            } else if(char === ',' && !inQuotes) {
                 result.push(current);
                 current = '';
            } else {
                 current += char;
            }
        }
        result.push(current);
        return result;
    }

    function cleanValue(val) {
        if (!val) return '';
        if(val.startsWith('="') && val.endsWith('"')) {
            val = val.substring(2, val.length - 1);
        } else if(val.startsWith('=')) {
            val = val.substring(1);
        } else if(val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
        }
        return val.trim();
    }

    function parseCSVData(csv) {
        const lines = csv.split('\n');
        if (lines.length < 2) return;
        
        const headerLine = lines[0];
        const headers = parseSimpleCSV(headerLine).map(h => cleanValue(h));
        
        const colCode = headers.indexOf('代號');
        const colName = headers.indexOf('名稱');
        const colPrice = headers.indexOf('成交');
        const colDiv = headers.indexOf('合計股利');
        const colYield = headers.indexOf('除權息年化合計殖利率');
        const colDate = headers.indexOf('除息交易日');

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const row = parseSimpleCSV(line);
            if (row.length <= Math.max(colCode, colName, colPrice)) continue;

            const code = cleanValue(row[colCode]);
            const name = cleanValue(row[colName]);
            const price = cleanValue(row[colPrice]);
            const div = cleanValue(row[colDiv]);
            const yieldVal = cleanValue(row[colYield]);
            const dateStr = cleanValue(row[colDate]);
            
            // Format date correctly
            let displayDate = dateStr;
            let month = '';
            if(displayDate.startsWith("'")) {
                displayDate = displayDate.substring(1);
                let parts = displayDate.split('/');
                if(parts.length === 3 && parts[0].length === 2) {
                    displayDate = `20${parts[0]}/${parts[1]}/${parts[2]}`;
                    month = parts[1];
                }
            }

            const parsedYieldNum = parseFloat(yieldVal) || 0;

            const item = {
                code,
                name,
                price: price || '--',
                dividend: div || '--',
                yield: yieldVal ? yieldVal + '%' : '--',
                yieldNum: parsedYieldNum,
                date: displayDate || '--',
                month: month
            };
            
            etfDataMap.set(code, item);
            etfList.push(item);
        }
    }

    function renderTable() {
        tableBody.innerHTML = '';
        const selectedMonth = monthSelect.value;
        const filteredList = selectedMonth ? etfList.filter(item => item.month === selectedMonth) : etfList;

        let dataToRender = [...filteredList];
        if (currentSortCol === 'yield') {
            dataToRender.sort((a, b) => currentSortDesc ? b.yieldNum - a.yieldNum : a.yieldNum - b.yieldNum);
        } else if (currentSortCol === 'date') {
            dataToRender.sort((a, b) => {
                const dateA = a.date !== '--' ? new Date(a.date).getTime() : 0;
                const dateB = b.date !== '--' ? new Date(b.date).getTime() : 0;
                return currentSortDesc ? dateB - dateA : dateA - dateB;
            });
        }

        dataToRender.forEach(item => {
            const tr = document.createElement('tr');
            
            const isHighYield = item.yieldNum >= 5;
            const yieldClass = isHighYield ? 'class="high-yield"' : '';

            tr.innerHTML = `
                <td class="code-cell">${item.code}</td>
                <td>${item.name}</td>
                <td>${item.price}</td>
                <td>${item.date}</td>
                <td>${item.dividend}</td>
                <td ${yieldClass}>${item.yield}</td>
            `;
            
            // Connect table row click to search feature
            tr.addEventListener('click', () => {
                searchInput.value = item.code;
                handleSearch();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            tableBody.appendChild(tr);
        });
    }

    function generateTrendAnalysis(data) {
        let text = `該標的（${data.name}）目前成交價約為 ${data.price}。`;
        
        if (data.yieldNum >= 8) {
            text += `其高達 ${data.yield} 的強勢殖利率在當前市場極具吸引力，預期未來高配息特性將持續吸引防禦型與存股型資金進駐，短期內可重點關注填息動能。`;
        } else if (data.yieldNum >= 4) {
            text += `擁有 ${data.yield} 的穩健殖利率水準，未來表現具備良好的下檔防禦性，是核心資產配置的優質選擇，有望達成長期持盈保泰。`;
        } else if (data.yieldNum > 0) {
            text += `目前年化殖利率為 ${data.yield}，未來整體報酬趨勢可能將更重度依賴其前十大成分股的資本利得成長（賺取價差），較適合偏好資產增值的積極型投資人。`;
        } else {
            text += `該標的目前並未配發穩定股利，其未來漲跌趨勢將完全取決於追蹤之大盤指數或特定產業板塊的短期與長期成長動能。`;
        }
        
        // Edge case check
        if(data.name.includes('正2') || data.name.includes('反1')) {
            text += `（註：槓桿或反向型 ETF 本質為獲取短期趨勢利潤，不建議作為長期存股之標的，請留意波動風險。）`;
        }
        
        return text;
    }

    function handleSearch() {
        const query = searchInput.value.trim().toUpperCase();
        if(!query) {
            showState(allDataBox);
            return;
        }

        const data = etfDataMap.get(query);
        if(data) {
            resCode.textContent = data.code;
            resName.textContent = data.name;
            resPrice.textContent = data.price;
            resDividend.textContent = data.dividend;
            resYield.textContent = data.yield;
            resDate.textContent = data.date;
            resAnalysis.textContent = generateTrendAnalysis(data);
            
            showState(resultCard);
        } else {
            showState(errorBox);
        }
    }

    function resetSearch() {
        searchInput.value = '';
        showState(allDataBox);
    }

    // Events
    searchBtn.addEventListener('click', handleSearch);
    backBtn.addEventListener('click', resetSearch);
    errorBackBtn.addEventListener('click', resetSearch);
    
    monthSelect.addEventListener('change', () => {
        renderTable();
        showState(allDataBox);
    });
    
    searchInput.addEventListener('input', (e) => {
        if(e.target.value.trim() === '') {
            showState(allDataBox);
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            handleSearch();
        }
    });

    const dateHeader = document.getElementById('dateHeader');
    const yieldHeader = document.getElementById('yieldHeader');

    function updateSortIcons() {
        const dateIcon = dateHeader.querySelector('.sort-icon');
        const yieldIcon = yieldHeader.querySelector('.sort-icon');
        dateIcon.textContent = '';
        yieldIcon.textContent = '';
        
        if (currentSortCol === 'date') {
            dateIcon.textContent = currentSortDesc ? ' ▼' : ' ▲';
        } else if (currentSortCol === 'yield') {
            yieldIcon.textContent = currentSortDesc ? ' ▼' : ' ▲';
        }
    }

    dateHeader.addEventListener('click', () => {
        if (currentSortCol === 'date') {
            currentSortDesc = !currentSortDesc;
        } else {
            currentSortCol = 'date';
            currentSortDesc = true;
        }
        updateSortIcons();
        renderTable();
    });

    yieldHeader.addEventListener('click', () => {
        if (currentSortCol === 'yield') {
            currentSortDesc = !currentSortDesc;
        } else {
            currentSortCol = 'yield';
            currentSortDesc = true;
        }
        updateSortIcons();
        renderTable();
    });
});
