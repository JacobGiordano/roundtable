function r(i){return i===void 0||i===0?null:i<.01?"< $0.01":i<1e3?`~$${i.toFixed(2)}`:`~$${i.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`}export{r as f};
