set :user, "deploy"
set :application, "codeshelver"
set :domain, "innovated.de"
set :deploy_to, "/var/www/#{application}"
set :repository, "git@git.innovated.de:#{application}.git"
set :copy_shared, { 'config/app.js' => 'config/app.js' }
set :symlinks, { 'config/app.js' => 'config/app.js' }
set :revision, "origin/master"
set :skip_scm, false
set :mkdirs, %w(tmp)
set :shared_paths, { 'log' => 'log' }
set :deploy_tasks, %w(
  vlad:update
  vlad:symlink
  vlad:bundle:install
  vlad:restart_app
  vlad:cleanup
)

require 'bundler/vlad'

namespace :vlad do

  desc 'Start the app'
  remote_task :start_app, :roles => :app do
    run "/etc/init.d/express_app #{application} start"
  end

  desc 'Stop the app'
  remote_task :stop_app, :roles => :app do
    run "/etc/init.d/express_app #{application} stop"
  end

  desc 'Restart the app'
  remote_task :restart_app, :roles => :app do
    %w(stop_app start_app).each { |task| Rake::Task["vlad:#{task}"].invoke }
  end

end