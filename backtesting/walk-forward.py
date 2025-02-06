# backtesting/walk-forward.py
def walk_forward_test(data, train_window=252, test_window=21):
    results = []
    for i in range(len(data)-train_window-test_window):
        train = data[i:i+train_window]
        test = data[i+train_window:i+train_window+test_window]
        
        model = train_model(train)
        results.append(backtest(model, test))
    
    return analyze_results(results)