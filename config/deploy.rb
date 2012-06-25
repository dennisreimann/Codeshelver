set :user, "deploy"
set :application, "codeshelver"
set :domain, "www.codeshelver.com"
set :deploy_to, "/var/www/#{application}"
set :repository, "git@github.com:dennisreimann/Codeshelver.git"
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
  vlad:app:restart
  vlad:cleanup
)

require 'bundler/vlad'

namespace :vlad do
  namespace :app do
    %w(start restart stop).each do |task|
      desc "#{task.capitalize} the app"
      remote_task task.to_sym, :roles => :app do
        puts "[App] #{task.capitalize}"
        sudo "#{task} #{application}"
      end
    end
  end
end
