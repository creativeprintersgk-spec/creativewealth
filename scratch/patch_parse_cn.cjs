const fs = require('fs');

let code = fs.readFileSync('scratch/parse_cn.py', 'utf-8');

// Fix ISIN Regex
code = code.replace(/INE\[A\-Z0\-9\]\{9\}/g, 'IN[A-Z0-9]{10}');

// Fix parse_dhan logic to handle 6-10 numbers properly
const newTradeLogic = `
        if len(nums) == 10:
            trades.append({
                "isin": isin,
                "assetName": name.strip(),
                "buyQty": nums[0],
                "buyWap": nums[1],
                "buyVal": nums[3],
                "sellQty": nums[4],
                "sellWap": nums[5],
                "sellVal": nums[7],
            })
        elif len(nums) >= 6:
            net_val = nums[-1]
            if net_val < 0: # BUY
                trades.append({
                    "isin": isin,
                    "assetName": name.strip(),
                    "buyQty": nums[0],
                    "buyWap": nums[1],
                    "buyVal": nums[3],
                    "sellQty": 0,
                    "sellWap": 0,
                    "sellVal": 0,
                })
            else: # SELL
                trades.append({
                    "isin": isin,
                    "assetName": name.strip(),
                    "buyQty": 0,
                    "buyWap": 0,
                    "buyVal": 0,
                    "sellQty": nums[0],
                    "sellWap": nums[1],
                    "sellVal": nums[3],
                })
`;

// In parse_dhan
code = code.replace(
/        if len\(nums\) >= 6:\n            trades\.append\(\{\n                "isin": isin,\n                "assetName": name\.strip\(\),\n                "buyQty": nums\[0\],\n                "buyWap": nums\[1\],\n                "buyVal": nums\[2\],\n                "sellQty": nums\[3\],\n                "sellWap": nums\[4\],\n                "sellVal": nums\[5\],\n            \}\)/g, 
newTradeLogic
);

fs.writeFileSync('scratch/parse_cn.py', code);
